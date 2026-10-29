use crate::enemy::{Enemy, EnemyCategory, EnemyVariant};
use crate::grid::{CellState, Grid, GRID_HEIGHT, GRID_WIDTH};
use crate::projectile::{Projectile, ProjectileType};
use crate::tower::{Tower, TowerType};
use crate::wave::WaveManager;

pub struct VisualEvent {
    pub event_type: u8, // 0: explosion, 1: laser, 2: lightning, 3: emp_pulse, 4: heal_aura, 5: tower_repair, 6: text
    pub x: f32,
    pub y: f32,
    pub target_x: f32,
    pub target_y: f32,
    pub value: f32,
}

pub struct Game {
    pub grid: Grid,
    pub towers: Vec<Tower>,
    pub enemies: Vec<Enemy>,
    pub projectiles: Vec<Projectile>,
    pub wave_manager: WaveManager,

    pub gold: i32,
    pub lives: i32,
    pub max_lives: i32,
    pub score: u32,
    pub game_over: bool,
    pub victory: bool,

    pub next_entity_id: usize,
    pub visual_events: Vec<VisualEvent>,

    // Stats
    pub total_enemies_killed: u32,
    pub total_damage_dealt: f32,
    pub towers_built: u32,
    pub towers_lost: u32,
}

impl Game {
    pub fn new() -> Self {
        let mut game = Self {
            grid: Grid::new(),
            towers: Vec::new(),
            enemies: Vec::new(),
            projectiles: Vec::new(),
            wave_manager: WaveManager::new(),
            gold: 450,
            lives: 20,
            max_lives: 20,
            score: 0,
            game_over: false,
            victory: false,
            next_entity_id: 1,
            visual_events: Vec::new(),
            total_enemies_killed: 0,
            total_damage_dealt: 0.0,
            towers_built: 0,
            towers_lost: 0,
        };
        game.grid.recalculate_flow_field();
        game
    }

    pub fn reset(&mut self) {
        *self = Self::new();
    }

    fn alloc_id(&mut self) -> usize {
        let id = self.next_entity_id;
        self.next_entity_id += 1;
        id
    }

    pub fn can_place_tower(&mut self, gx: usize, gy: usize) -> bool {
        let walker_positions: Vec<(f32, f32)> = self
            .enemies
            .iter()
            .filter(|e| e.category == EnemyCategory::Walker || e.category == EnemyCategory::Boss)
            .map(|e| (e.x, e.y))
            .collect();
        self.grid.can_place_tower(gx, gy, &walker_positions)
    }

    pub fn place_tower(&mut self, gx: usize, gy: usize, t_type: TowerType) -> i32 {
        if !self.can_place_tower(gx, gy) {
            return -1; // Cannot place (invalid or blocks path)
        }
        let cost = t_type.base_cost();
        if self.gold < cost as i32 {
            return -2; // Not enough gold
        }

        self.gold -= cost as i32;
        let id = self.alloc_id();
        let tower = Tower::new(id, gx, gy, t_type);
        self.towers.push(tower);
        self.towers_built += 1;

        self.grid.cells[self.grid.idx(gx, gy)] = CellState::Tower(id);
        self.grid.recalculate_flow_field();

        id as i32
    }

    pub fn upgrade_tower(&mut self, tower_id: usize) -> i32 {
        if let Some(pos) = self.towers.iter().position(|t| t.id == tower_id) {
            let cost = self.towers[pos].upgrade_cost();
            if cost == 0 {
                return -3; // Max tier
            }
            if self.gold < cost as i32 {
                return -2; // Not enough gold
            }
            self.gold -= cost as i32;
            self.towers[pos].upgrade();
            self.visual_events.push(VisualEvent {
                event_type: 5,
                x: self.towers[pos].world_x,
                y: self.towers[pos].world_y,
                target_x: 0.0,
                target_y: 0.0,
                value: self.towers[pos].tier as f32,
            });
            return self.towers[pos].tier as i32;
        }
        -1
    }

    pub fn repair_tower(&mut self, tower_id: usize) -> i32 {
        if let Some(pos) = self.towers.iter().position(|t| t.id == tower_id) {
            let cost = self.towers[pos].repair_cost();
            if cost == 0 {
                return -3; // Full health already
            }
            if self.gold < cost as i32 {
                return -2; // Not enough gold
            }
            self.gold -= cost as i32;
            self.towers[pos].repair();
            self.visual_events.push(VisualEvent {
                event_type: 5,
                x: self.towers[pos].world_x,
                y: self.towers[pos].world_y,
                target_x: 0.0,
                target_y: 0.0,
                value: 100.0,
            });
            return 1;
        }
        -1
    }

    pub fn sell_tower(&mut self, tower_id: usize) -> i32 {
        if let Some(pos) = self.towers.iter().position(|t| t.id == tower_id) {
            let refund = self.towers[pos].sell_refund();
            let gx = self.towers[pos].gx;
            let gy = self.towers[pos].gy;

            self.gold += refund as i32;
            self.towers.remove(pos);

            let idx = self.grid.idx(gx, gy);
            self.grid.cells[idx] = CellState::Empty;
            self.grid.recalculate_flow_field();
            return refund as i32;
        }
        -1
    }

    pub fn start_next_wave(&mut self) -> bool {
        if self.wave_manager.is_wave_active {
            return false;
        }
        // Early wave bonus gold: if player starts early, give bonus gold based on remaining timer
        let bonus = (self.wave_manager.time_until_next_wave * 2.0) as i32;
        if bonus > 0 && self.wave_manager.current_wave > 0 {
            self.gold += bonus;
        }
        self.wave_manager.start_next_wave()
    }

    pub fn update(&mut self, dt: f32) {
        if self.game_over || self.lives <= 0 {
            self.game_over = true;
            return;
        }

        self.visual_events.clear();

        // 1. Wave spawning
        self.update_wave_spawn(dt);

        // 2. Update status & movements of enemies
        self.update_enemies(dt);

        // 3. Update towers (support healing, targeting, attacks)
        self.update_towers(dt);

        // 4. Update projectiles
        self.update_projectiles(dt);

        // 5. Cleanup dead entities & check wave completion
        self.cleanup();
    }

    fn update_wave_spawn(&mut self, dt: f32) {
        if !self.wave_manager.is_wave_active {
            if self.wave_manager.time_until_next_wave > 0.0 {
                self.wave_manager.time_until_next_wave -= dt;
                if self.wave_manager.time_until_next_wave <= 0.0 {
                    self.wave_manager.start_next_wave();
                }
            }
            return;
        }

        if !self.wave_manager.spawn_queue.is_empty() {
            self.wave_manager.spawn_timer -= dt;
            if self.wave_manager.spawn_timer <= 0.0 {
                let item = self.wave_manager.spawn_queue.remove(0);
                let id = self.alloc_id();
                let wave_multiplier = 1.0 + (self.wave_manager.current_wave as f32 - 1.0) * 0.16;
                let enemy = Enemy::new(id, item.variant, wave_multiplier);
                self.enemies.push(enemy);
                self.wave_manager.enemies_spawned += 1;
                self.wave_manager.spawn_timer = item.delay;
            }
        } else if self.enemies.is_empty() {
            // Wave complete!
            self.wave_manager.is_wave_active = false;
            self.wave_manager.time_until_next_wave = 15.0; // Break between waves
            let wave_bonus = 60 + self.wave_manager.current_wave * 15;
            self.gold += wave_bonus as i32;
            self.score += self.wave_manager.current_wave * 250;
        }
    }

    fn update_enemies(&mut self, dt: f32) {
        let mut new_projectiles = Vec::new();
        let mut new_spawned_minions = Vec::new();

        // Snapshot of towers for enemy targeting & attacks
        let tower_positions: Vec<(usize, usize, usize, f32, f32)> = self
            .towers
            .iter()
            .map(|t| (t.id, t.gx, t.gy, t.world_x, t.world_y))
            .collect();

        for enemy in self.enemies.iter_mut() {
            enemy.update_status(dt);
            if enemy.is_dead {
                continue;
            }

            // Special support aura: Healer heals nearby allies
            if enemy.variant == EnemyVariant::Healer && enemy.special_ability_timer <= 0.0 {
                enemy.special_ability_timer = 2.0;
                // Emit heal pulse event
                // Will be applied in a second pass or directly
            }

            // Handle behavior depending on category
            match enemy.category {
                EnemyCategory::Walker => {
                    Self::move_walker(enemy, &self.grid, dt);
                }
                EnemyCategory::TowerAttacker => {
                    Self::update_tower_attacker(
                        enemy,
                        &self.grid,
                        &tower_positions,
                        dt,
                        &mut new_projectiles,
                    );
                }
                EnemyCategory::Boss => {
                    Self::update_boss(
                        enemy,
                        &self.grid,
                        &tower_positions,
                        dt,
                        &mut new_projectiles,
                        &mut new_spawned_minions,
                    );
                }
            }

            // Check if enemy reached goal (right side)
            let gx = enemy.x.floor() as usize;
            let gy = enemy.y.floor() as usize;
            if gx >= self.grid.goal_x && gy == self.grid.goal_y {
                enemy.reached_goal = true;
                let lives_cost = if enemy.category == EnemyCategory::Boss { 5 } else { 1 };
                self.lives -= lives_cost;
                enemy.is_dead = true;
            }
        }

        // Apply healer pulses to nearby wounded allies
        for i in 0..self.enemies.len() {
            if self.enemies[i].variant == EnemyVariant::Healer && self.enemies[i].special_ability_timer >= 1.95 {
                let hx = self.enemies[i].x;
                let hy = self.enemies[i].y;
                for j in 0..self.enemies.len() {
                    if i != j && !self.enemies[j].is_dead {
                        let dist_sq = (self.enemies[j].x - hx).powi(2) + (self.enemies[j].y - hy).powi(2);
                        if dist_sq <= 3.0 * 3.0 {
                            self.enemies[j].hp = (self.enemies[j].hp + 35.0).min(self.enemies[j].max_hp);
                        }
                    }
                }
                self.visual_events.push(VisualEvent {
                    event_type: 4,
                    x: hx,
                    y: hy,
                    target_x: 0.0,
                    target_y: 0.0,
                    value: 3.0,
                });
            }
        }

        // Append boss-spawned minions
        for minion in new_spawned_minions {
            let id = self.alloc_id();
            let wave_mul = 1.0 + (self.wave_manager.current_wave as f32 - 1.0) * 0.15;
            let mut e = Enemy::new(id, minion.variant, wave_mul);
            e.x = minion.x;
            e.y = minion.y;
            self.enemies.push(e);
        }

        // Append enemy projectiles
        for mut p in new_projectiles {
            p.id = self.alloc_id();
            self.projectiles.push(p);
        }
    }

    fn move_walker(enemy: &mut Enemy, grid: &Grid, dt: f32) {
        let gx = (enemy.x.floor() as usize).min(GRID_WIDTH - 1);
        let gy = (enemy.y.floor() as usize).min(GRID_HEIGHT - 1);
        let idx = grid.idx(gx, gy);
        let (dx, dy) = grid.flow_field[idx];

        if dx != 0 || dy != 0 {
            // Target center of next cell
            let next_gx = (gx as isize + dx as isize).max(0).min(GRID_WIDTH as isize - 1) as usize;
            let next_gy = (gy as isize + dy as isize).max(0).min(GRID_HEIGHT as isize - 1) as usize;
            let target_cx = next_gx as f32 + 0.5;
            let target_cy = next_gy as f32 + 0.5;

            let diff_x = target_cx - enemy.x;
            let diff_y = target_cy - enemy.y;
            let dist = (diff_x * diff_x + diff_y * diff_y).sqrt();

            if dist > 0.05 {
                let step = (enemy.current_speed * dt).min(dist);
                enemy.x += (diff_x / dist) * step;
                enemy.y += (diff_y / dist) * step;
                enemy.rotation = diff_y.atan2(diff_x);
            } else {
                enemy.x = target_cx;
                enemy.y = target_cy;
            }
        } else {
            // Fallback move right
            enemy.x += enemy.current_speed * dt;
        }
    }

    fn update_tower_attacker(
        enemy: &mut Enemy,
        grid: &Grid,
        towers: &[(usize, usize, usize, f32, f32)],
        dt: f32,
        new_projectiles: &mut Vec<Projectile>,
    ) {
        // Find closest tower in attack range or aggro range
        let mut closest_tower: Option<(usize, f32, f32, f32)> = None;
        let mut min_dist = f32::MAX;

        for &(t_id, _, _, tx, ty) in towers {
            let dist = ((tx - enemy.x).powi(2) + (ty - enemy.y).powi(2)).sqrt();
            if dist < min_dist {
                min_dist = dist;
                closest_tower = Some((t_id, tx, ty, dist));
            }
        }

        // If a tower is within attack range
        if let Some((t_id, tx, ty, dist)) = closest_tower {
            if dist <= enemy.attack_range {
                // In range! Face tower and attack
                enemy.rotation = (ty - enemy.y).atan2(tx - enemy.x);

                if enemy.current_cooldown <= 0.0 {
                    enemy.current_cooldown = enemy.attack_cooldown;

                    match enemy.variant {
                        EnemyVariant::Bomber => {
                            // Suicide Bomber: detonates!
                            enemy.is_dead = true;
                            // Splash damage to towers within 1.4 tiles
                            new_projectiles.push(Projectile::new_enemy_mortar(
                                0,
                                enemy.x,
                                enemy.y,
                                t_id as i32,
                                tx,
                                ty,
                                enemy.attack_power,
                            ));
                        }
                        EnemyVariant::ArtilleryBug => {
                            // Ranged mortar shell
                            new_projectiles.push(Projectile::new_enemy_mortar(
                                0,
                                enemy.x,
                                enemy.y,
                                t_id as i32,
                                tx,
                                ty,
                                enemy.attack_power,
                            ));
                        }
                        EnemyVariant::AcidSpitter => {
                            // Acid glob projectile
                            new_projectiles.push(Projectile::new_enemy_acid(
                                0,
                                enemy.x,
                                enemy.y,
                                t_id as i32,
                                tx,
                                ty,
                                enemy.attack_power,
                            ));
                        }
                        EnemyVariant::EMPDisruptor => {
                            // EMP Shockwave stunning towers in range
                            new_projectiles.push(Projectile::new_enemy_mortar(
                                0,
                                enemy.x,
                                enemy.y,
                                t_id as i32,
                                tx,
                                ty,
                                enemy.attack_power,
                            ));
                        }
                        _ => {
                            // Melee punch (Siege Brawler)
                            new_projectiles.push(Projectile::new_bullet(
                                0,
                                enemy.x,
                                enemy.y,
                                -1,
                                tx,
                                ty,
                                enemy.attack_power,
                            ));
                        }
                    }
                }
                return; // Stop while attacking
            }

            // If tower is blocking path or nearby, move toward it if aggressive
            if enemy.variant == EnemyVariant::SiegeBrawler || enemy.variant == EnemyVariant::Bomber {
                if dist < 4.5 {
                    let diff_x = tx - enemy.x;
                    let diff_y = ty - enemy.y;
                    let step = (enemy.current_speed * dt).min(dist);
                    enemy.x += (diff_x / dist) * step;
                    enemy.y += (diff_y / dist) * step;
                    enemy.rotation = diff_y.atan2(diff_x);
                    return;
                }
            }
        }

        // Otherwise follow flow field
        Self::move_walker(enemy, grid, dt);
    }

    fn update_boss(
        enemy: &mut Enemy,
        grid: &Grid,
        towers: &[(usize, usize, usize, f32, f32)],
        dt: f32,
        new_projectiles: &mut Vec<Projectile>,
        new_minions: &mut Vec<SpawnedMinion>,
    ) {
        // Boss moves along the flow field
        Self::move_walker(enemy, grid, dt);

        // Special Boss abilities on cooldown
        if enemy.current_cooldown <= 0.0 {
            enemy.current_cooldown = enemy.attack_cooldown;

            match enemy.variant {
                EnemyVariant::TitanColossus => {
                    // Stomp shockwave damaging nearby towers
                    for &(t_id, _, _, tx, ty) in towers {
                        let dist = ((tx - enemy.x).powi(2) + (ty - enemy.y).powi(2)).sqrt();
                        if dist <= 3.0 {
                            new_projectiles.push(Projectile::new_enemy_mortar(
                                0,
                                enemy.x,
                                enemy.y,
                                t_id as i32,
                                tx,
                                ty,
                                enemy.attack_power * 0.7,
                            ));
                        }
                    }
                }
                EnemyVariant::Broodmother => {
                    // Hatch minions!
                    new_minions.push(SpawnedMinion {
                        variant: EnemyVariant::Swarm,
                        x: enemy.x - 0.3,
                        y: enemy.y - 0.3,
                    });
                    new_minions.push(SpawnedMinion {
                        variant: EnemyVariant::Swarm,
                        x: enemy.x + 0.3,
                        y: enemy.y + 0.3,
                    });
                }
                EnemyVariant::AnnihilatorMech => {
                    // Annihilator beam / heavy artillery at closest tower
                    for &(t_id, _, _, tx, ty) in towers {
                        let dist = ((tx - enemy.x).powi(2) + (ty - enemy.y).powi(2)).sqrt();
                        if dist <= 4.5 {
                            new_projectiles.push(Projectile::new_enemy_mortar(
                                0,
                                enemy.x,
                                enemy.y,
                                t_id as i32,
                                tx,
                                ty,
                                enemy.attack_power,
                            ));
                            break;
                        }
                    }
                }
                _ => {}
            }
        }
    }

    fn update_towers(&mut self, dt: f32) {
        // Step A: Aegis Towers repair nearby towers and grant fire-rate buffs
        for i in 0..self.towers.len() {
            if self.towers[i].tower_type == TowerType::Aegis {
                let ax = self.towers[i].world_x;
                let ay = self.towers[i].world_y;
                let range = self.towers[i].range;
                let repair_amount = match self.towers[i].tier {
                    1 => 12.0 * dt,
                    2 => 24.0 * dt,
                    _ => 40.0 * dt,
                };

                for j in 0..self.towers.len() {
                    if i != j {
                        let dist = ((self.towers[j].world_x - ax).powi(2) + (self.towers[j].world_y - ay).powi(2)).sqrt();
                        if dist <= range {
                            if self.towers[j].hp < self.towers[j].max_hp {
                                self.towers[j].hp = (self.towers[j].hp + repair_amount).min(self.towers[j].max_hp);
                            }
                        }
                    }
                }
            }
        }

        // Step B: Defensive Towers attack enemies
        let mut new_projs = Vec::new();

        for tower in self.towers.iter_mut() {
            // Stun effect from EMP
            if tower.stun_timer > 0.0 {
                tower.stun_timer -= dt;
                continue;
            }

            if tower.tower_type == TowerType::Aegis {
                continue;
            }

            if tower.cooldown > 0.0 {
                tower.cooldown -= dt;
            }

            // Find target enemy in range
            let mut target_idx: Option<usize> = None;

            if tower.tower_type == TowerType::Sniper {
                // Sniper prioritizes highest HP enemy (Bosses & Armored)
                let mut max_hp = -1.0;
                for (idx, enemy) in self.enemies.iter().enumerate() {
                    if enemy.is_dead {
                        continue;
                    }
                    let dist = ((enemy.x - tower.world_x).powi(2) + (enemy.y - tower.world_y).powi(2)).sqrt();
                    if dist <= tower.range && enemy.hp > max_hp {
                        max_hp = enemy.hp;
                        target_idx = Some(idx);
                    }
                }
            } else {
                // Other towers target the enemy furthest along the path (closest to goal)
                let mut max_progress = -9999.0;
                for (idx, enemy) in self.enemies.iter().enumerate() {
                    if enemy.is_dead {
                        continue;
                    }
                    let dist = ((enemy.x - tower.world_x).powi(2) + (enemy.y - tower.world_y).powi(2)).sqrt();
                    if dist <= tower.range {
                        // Progress = enemy.x (flowing left to right toward goal)
                        if enemy.x > max_progress {
                            max_progress = enemy.x;
                            target_idx = Some(idx);
                        }
                    }
                }
            }

            if let Some(t_idx) = target_idx {
                let enemy = &mut self.enemies[t_idx];
                tower.target_id = enemy.id as i32;
                tower.rotation = (enemy.y - tower.world_y).atan2(enemy.x - tower.world_x);

                // Laser continuous beam
                if tower.tower_type == TowerType::Laser {
                    if tower.laser_target_id == enemy.id as i32 {
                        tower.laser_ramp_time += dt;
                    } else {
                        tower.laser_target_id = enemy.id as i32;
                        tower.laser_ramp_time = 0.0;
                    }
                    let ramp_factor = 1.0 + (tower.laser_ramp_time * 0.8).min(3.0);
                    let beam_damage = tower.damage * ramp_factor * dt;
                    enemy.take_damage(beam_damage);
                    tower.total_damage += beam_damage;
                    if enemy.is_dead {
                        tower.kills += 1;
                        tower.laser_target_id = -1;
                        tower.laser_ramp_time = 0.0;
                    }

                    self.visual_events.push(VisualEvent {
                        event_type: 1,
                        x: tower.world_x,
                        y: tower.world_y,
                        target_x: enemy.x,
                        target_y: enemy.y,
                        value: tower.tier as f32,
                    });
                    continue;
                }

                // Periodic firing towers
                if tower.cooldown <= 0.0 {
                    tower.cooldown = 1.0 / tower.fire_rate;

                    match tower.tower_type {
                        TowerType::Gatling => {
                            new_projs.push(Projectile::new_bullet(
                                0,
                                tower.world_x,
                                tower.world_y,
                                enemy.id as i32,
                                enemy.x,
                                enemy.y,
                                tower.damage,
                            ));
                        }
                        TowerType::Cannon => {
                            let splash = 1.2 + (tower.tier as f32 * 0.3);
                            new_projs.push(Projectile::new_cannon_shell(
                                0,
                                tower.world_x,
                                tower.world_y,
                                enemy.x,
                                enemy.y,
                                tower.damage,
                                splash,
                            ));
                        }
                        TowerType::Cryo => {
                            let slow = 0.55 - (tower.tier as f32 * 0.08);
                            let dur = 2.0 + (tower.tier as f32 * 0.5);
                            new_projs.push(Projectile::new_ice_shard(
                                0,
                                tower.world_x,
                                tower.world_y,
                                enemy.id as i32,
                                enemy.x,
                                enemy.y,
                                tower.damage,
                                slow,
                                dur,
                            ));
                        }
                        TowerType::Tesla => {
                            // Instant lightning chain
                            let max_chains = 2 + (tower.tier as usize * 2);
                            let mut chained_targets = Vec::new();
                            let mut current_tx = tower.world_x;
                            let mut current_ty = tower.world_y;
                            let mut dmg = tower.damage;

                            for _ in 0..max_chains {
                                let mut best_next: Option<(usize, f32, f32)> = None;
                                let mut min_d = f32::MAX;
                                for (e_idx, other) in self.enemies.iter().enumerate() {
                                    if other.is_dead || chained_targets.contains(&other.id) {
                                        continue;
                                    }
                                    let d = ((other.x - current_tx).powi(2) + (other.y - current_ty).powi(2)).sqrt();
                                    if d < min_d && d <= 3.2 {
                                        min_d = d;
                                        best_next = Some((e_idx, other.x, other.y));
                                    }
                                }

                                if let Some((c_idx, nx, ny)) = best_next {
                                    self.visual_events.push(VisualEvent {
                                        event_type: 2,
                                        x: current_tx,
                                        y: current_ty,
                                        target_x: nx,
                                        target_y: ny,
                                        value: tower.tier as f32,
                                    });
                                    let target_enemy = &mut self.enemies[c_idx];
                                    target_enemy.take_damage(dmg);
                                    tower.total_damage += dmg;
                                    if target_enemy.is_dead {
                                        tower.kills += 1;
                                    }
                                    chained_targets.push(target_enemy.id);
                                    current_tx = nx;
                                    current_ty = ny;
                                    dmg *= 0.8; // Chain falloff
                                } else {
                                    break;
                                }
                            }
                        }
                        TowerType::Flamethrower => {
                            new_projs.push(Projectile::new_flame(
                                0,
                                tower.world_x,
                                tower.world_y,
                                enemy.x,
                                enemy.y,
                                tower.damage,
                                tower.damage * 0.7,
                            ));
                        }
                        TowerType::Sniper => {
                            // Instant piercing railgun shot
                            enemy.take_damage(tower.damage);
                            tower.total_damage += tower.damage;
                            if enemy.is_dead {
                                tower.kills += 1;
                            }
                            self.visual_events.push(VisualEvent {
                                event_type: 1, // Ray line
                                x: tower.world_x,
                                y: tower.world_y,
                                target_x: enemy.x,
                                target_y: enemy.y,
                                value: 4.0, // Thick rail beam
                            });
                        }
                        _ => {}
                    }
                }
            } else {
                tower.target_id = -1;
                tower.laser_target_id = -1;
                tower.laser_ramp_time = 0.0;
            }
        }

        for mut p in new_projs {
            p.id = self.alloc_id();
            self.projectiles.push(p);
        }
    }

    fn update_projectiles(&mut self, dt: f32) {
        for proj in self.projectiles.iter_mut() {
            proj.lifetime += dt;
            if proj.lifetime >= proj.max_lifetime {
                proj.is_expired = true;
                continue;
            }

            // Move projectile towards target
            let diff_x = proj.target_x - proj.x;
            let diff_y = proj.target_y - proj.y;
            let dist = (diff_x * diff_x + diff_y * diff_y).sqrt();

            let step = proj.speed * dt;
            if step >= dist {
                proj.x = proj.target_x;
                proj.y = proj.target_y;
                proj.is_expired = true;
            } else {
                proj.x += (diff_x / dist) * step;
                proj.y += (diff_y / dist) * step;
            }

            // Check if it reached destination
            if proj.is_expired {
                match proj.proj_type {
                    ProjectileType::Bullet => {
                        for enemy in self.enemies.iter_mut() {
                            if enemy.id as i32 == proj.target_enemy_id && !enemy.is_dead {
                                enemy.take_damage(proj.damage);
                                self.total_damage_dealt += proj.damage;
                                break;
                            }
                        }
                    }
                    ProjectileType::CannonShell => {
                        for enemy in self.enemies.iter_mut() {
                            if enemy.is_dead {
                                continue;
                            }
                            let d = ((enemy.x - proj.x).powi(2) + (enemy.y - proj.y).powi(2)).sqrt();
                            if d <= proj.splash_radius {
                                let falloff = 1.0 - (d / proj.splash_radius) * 0.4;
                                let dmg = proj.damage * falloff;
                                enemy.take_damage(dmg);
                                self.total_damage_dealt += dmg;
                            }
                        }
                        self.visual_events.push(VisualEvent {
                            event_type: 0, // Explosion
                            x: proj.x,
                            y: proj.y,
                            target_x: 0.0,
                            target_y: 0.0,
                            value: proj.splash_radius,
                        });
                    }
                    ProjectileType::IceShard => {
                        for enemy in self.enemies.iter_mut() {
                            if enemy.is_dead {
                                continue;
                            }
                            let d = ((enemy.x - proj.x).powi(2) + (enemy.y - proj.y).powi(2)).sqrt();
                            if d <= proj.splash_radius {
                                enemy.take_damage(proj.damage);
                                enemy.apply_slow(proj.slow_factor, proj.slow_duration);
                                self.total_damage_dealt += proj.damage;
                            }
                        }
                    }
                    ProjectileType::FlameParticle => {
                        for enemy in self.enemies.iter_mut() {
                            if enemy.is_dead {
                                continue;
                            }
                            let d = ((enemy.x - proj.x).powi(2) + (enemy.y - proj.y).powi(2)).sqrt();
                            if d <= proj.splash_radius {
                                enemy.take_damage(proj.damage);
                                enemy.apply_burn(proj.burn_dps, proj.burn_duration);
                                self.total_damage_dealt += proj.damage;
                            }
                        }
                    }
                    ProjectileType::EnemyMortar | ProjectileType::EnemyAcid => {
                        // Damages towers in splash radius!
                        for tower in self.towers.iter_mut() {
                            let d = ((tower.world_x - proj.x).powi(2) + (tower.world_y - proj.y).powi(2)).sqrt();
                            if d <= proj.splash_radius {
                                tower.take_damage(proj.damage);
                            }
                        }
                        self.visual_events.push(VisualEvent {
                            event_type: 0,
                            x: proj.x,
                            y: proj.y,
                            target_x: 0.0,
                            target_y: 0.0,
                            value: proj.splash_radius,
                        });
                    }
                    _ => {}
                }
            }
        }
    }

    fn cleanup(&mut self) {
        // Collect rewards from dead enemies
        let mut earned_gold = 0;
        let mut earned_score = 0;

        for enemy in self.enemies.iter() {
            if enemy.is_dead && !enemy.reached_goal {
                earned_gold += enemy.gold_bounty as i32;
                earned_score += enemy.score_value;
                self.total_enemies_killed += 1;
            }
        }
        self.gold += earned_gold;
        self.score += earned_score;

        // Remove dead enemies
        self.enemies.retain(|e| !e.is_dead);

        // Remove expired projectiles
        self.projectiles.retain(|p| !p.is_expired);

        // Remove destroyed towers and recalculate flow field if any fell
        let mut lost_any_tower = false;
        let mut destroyed_indices = Vec::new();
        for (idx, tower) in self.towers.iter().enumerate() {
            if tower.hp <= 0.0 {
                destroyed_indices.push(idx);
                lost_any_tower = true;
                self.towers_lost += 1;
            }
        }

        if lost_any_tower {
            // Remove from grid
            for &idx in destroyed_indices.iter().rev() {
                let gx = self.towers[idx].gx;
                let gy = self.towers[idx].gy;
                let g_idx = self.grid.idx(gx, gy);
                self.grid.cells[g_idx] = CellState::Empty;
                self.towers.remove(idx);
            }
            self.grid.recalculate_flow_field();
        }
    }
}

pub struct SpawnedMinion {
    pub variant: EnemyVariant,
    pub x: f32,
    pub y: f32,
}
