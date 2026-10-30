use crate::enemy::{Enemy, EnemyCategory, EnemyVariant};
use crate::grid::{CellState, Grid, GRID_HEIGHT, GRID_WIDTH};
use crate::projectile::{Projectile, ProjectileType};
use crate::tower::{Tower, TowerType};
use crate::wave::WaveManager;

#[derive(Clone, Debug)]
pub struct CommanderAbilities {
    pub emp_cooldown: f32,
    pub emp_max_cooldown: f32,
    pub strike_cooldown: f32,
    pub strike_max_cooldown: f32,
    pub overdrive_timer: f32,
    pub overdrive_cooldown: f32,
    pub overdrive_max_cooldown: f32,
}

impl CommanderAbilities {
    pub fn new() -> Self {
        Self {
            emp_cooldown: 0.0,
            emp_max_cooldown: 35.0,
            strike_cooldown: 0.0,
            strike_max_cooldown: 45.0,
            overdrive_timer: 0.0,
            overdrive_cooldown: 0.0,
            overdrive_max_cooldown: 48.0,
        }
    }

    pub fn update(&mut self, dt: f32) {
        if self.emp_cooldown > 0.0 {
            self.emp_cooldown = (self.emp_cooldown - dt).max(0.0);
        }
        if self.strike_cooldown > 0.0 {
            self.strike_cooldown = (self.strike_cooldown - dt).max(0.0);
        }
        if self.overdrive_cooldown > 0.0 {
            self.overdrive_cooldown = (self.overdrive_cooldown - dt).max(0.0);
        }
        if self.overdrive_timer > 0.0 {
            self.overdrive_timer = (self.overdrive_timer - dt).max(0.0);
        }
    }
}

pub struct VisualEvent {
    pub event_type: u8, // 0: explosion/impact, 1: laser, 2: lightning, 3: emp_pulse, 4: heal_aura, 5: tower_repair, 6: text
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
    pub abilities: CommanderAbilities,

    pub gold: i32,
    pub lives: i32,
    pub max_lives: i32,
    pub score: u32,
    pub game_over: bool,
    pub victory: bool,

    pub current_level: usize,
    pub max_unlocked_level: usize,
    pub level_completed: bool,

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
            abilities: CommanderAbilities::new(),
            gold: 450,
            lives: 20,
            max_lives: 20,
            score: 0,
            game_over: false,
            victory: false,
            current_level: 1,
            max_unlocked_level: 1,
            level_completed: false,
            next_entity_id: 1,
            visual_events: Vec::new(),
            total_enemies_killed: 0,
            total_damage_dealt: 0.0,
            towers_built: 0,
            towers_lost: 0,
        };
        game.grid.load_level(1);
        game
    }

    pub fn reset(&mut self) {
        let lvl = self.current_level;
        let max_unlocked = self.max_unlocked_level;
        *self = Self::new();
        self.max_unlocked_level = max_unlocked;
        self.load_level(lvl);
    }

    pub fn load_level(&mut self, level: usize) -> bool {
        let lvl = level.clamp(1, 5);
        if lvl > self.max_unlocked_level {
            return false;
        }

        self.current_level = lvl;
        self.grid.load_level(lvl);
        self.towers.clear();
        self.enemies.clear();
        self.projectiles.clear();
        self.wave_manager = WaveManager::new();
        self.abilities = CommanderAbilities::new();
        self.gold = 450 + (lvl as i32 - 1) * 75;
        self.lives = 20;
        self.game_over = false;
        self.victory = false;
        self.level_completed = false;
        true
    }

    pub fn alloc_id(&mut self) -> usize {
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
            return -1; // Cannot place (invalid, obstacle, or blocks path)
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

        // 0. Update Commander tactical abilities
        self.abilities.update(dt);

        // 1. Wave spawning
        self.update_wave_spawn(dt);

        // 2. Update status & movements of enemies (including direct tower attack hits!)
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

                // EXPONENTIAL DIFFICULTY SCALING:
                // Waves 1-5 ramp normally up to first Titan.
                // Every 4 waves after Wave 5 (waves 9, 13, 17, 21, ...) difficulty multiplies exponentially!
                let wave = self.wave_manager.current_wave;
                let surge_tier = if wave > 5 { (wave - 5) / 4 } else { 0 };
                let wave_in_tier = if wave > 5 { (wave - 5) % 4 } else { wave };
                let surge_mult = 1.75_f32.powi(surge_tier as i32);
                let linear_scale = 1.0 + (wave as f32 - 1.0) * 0.16 + (wave_in_tier as f32 * 0.10);
                let wave_multiplier = linear_scale * surge_mult;

                let sx = self.grid.spawn_x as f32 + 0.5;
                let sy = self.grid.spawn_y as f32 + 0.5;
                let enemy = Enemy::new(id, item.variant, wave_multiplier, surge_tier, sx, sy);
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

            // Check Level Unlocking: Completing Wave 10 unlocks next level (up to 5)!
            if self.wave_manager.current_wave >= 10 {
                self.level_completed = true;
                if self.current_level >= self.max_unlocked_level && self.current_level < 5 {
                    self.max_unlocked_level = self.current_level + 1;
                    self.visual_events.push(VisualEvent {
                        event_type: 6, // Text notification
                        x: 12.0,
                        y: 7.0,
                        target_x: 0.0,
                        target_y: 0.0,
                        value: self.max_unlocked_level as f32,
                    });
                }
            }
        }
    }

    fn update_enemies(&mut self, dt: f32) {
        let mut new_projectiles = Vec::new();
        let mut new_spawned_minions = Vec::new();

        // Direct damage applications: (target_tower_id, damage, event_x, event_y)
        let mut direct_tower_hits = Vec::new();
        let mut emp_pulses = Vec::new();

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

            // Healer pulse
            if enemy.variant == EnemyVariant::Healer && enemy.special_ability_timer <= 0.0 {
                enemy.special_ability_timer = 2.0;
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
                        &mut direct_tower_hits,
                        &mut emp_pulses,
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
                        &mut direct_tower_hits,
                    );
                }
            }

            // Check if enemy reached goal
            let goal_cx = self.grid.goal_x as f32 + 0.5;
            let goal_cy = self.grid.goal_y as f32 + 0.5;
            let dist_to_goal = ((enemy.x - goal_cx).powi(2) + (enemy.y - goal_cy).powi(2)).sqrt();

            if dist_to_goal < 0.7 {
                enemy.reached_goal = true;
                let lives_cost = if enemy.category == EnemyCategory::Boss { 5 } else { 1 };
                self.lives -= lives_cost;
                enemy.is_dead = true;
            }
        }

        // Apply direct melee hits and impacts to towers!
        for (t_id, dmg, fx, fy) in direct_tower_hits {
            if let Some(t) = self.towers.iter_mut().find(|t| t.id == t_id) {
                t.take_damage(dmg);
                self.visual_events.push(VisualEvent {
                    event_type: 0, // Impact flash
                    x: fx,
                    y: fy,
                    target_x: 0.0,
                    target_y: 0.0,
                    value: 0.8,
                });
            }
        }

        // Apply EMP pulses
        for (ex, ey, radius, stun_dur, dmg) in emp_pulses {
            for t in self.towers.iter_mut() {
                let d = ((t.world_x - ex).powi(2) + (t.world_y - ey).powi(2)).sqrt();
                if d <= radius {
                    t.stun_timer = stun_dur;
                    t.take_damage(dmg);
                }
            }
            self.visual_events.push(VisualEvent {
                event_type: 3, // EMP ring
                x: ex,
                y: ey,
                target_x: 0.0,
                target_y: 0.0,
                value: radius,
            });
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
            let wave = self.wave_manager.current_wave;
            let surge_tier = if wave > 5 { (wave - 5) / 4 } else { 0 };
            let surge_mult = 1.75_f32.powi(surge_tier as i32);
            let wave_mul = (1.0 + (wave as f32 - 1.0) * 0.15) * surge_mult;
            let enemy = Enemy::new(id, minion.variant, wave_mul, surge_tier, minion.x, minion.y);
            self.enemies.push(enemy);
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
            // Default step towards goal
            let goal_cx = grid.goal_x as f32 + 0.5;
            let goal_cy = grid.goal_y as f32 + 0.5;
            let diff_x = goal_cx - enemy.x;
            let diff_y = goal_cy - enemy.y;
            let dist = (diff_x * diff_x + diff_y * diff_y).sqrt();
            if dist > 0.05 {
                let step = (enemy.current_speed * dt).min(dist);
                enemy.x += (diff_x / dist) * step;
                enemy.y += (diff_y / dist) * step;
                enemy.rotation = diff_y.atan2(diff_x);
            }
        }
    }

    fn update_tower_attacker(
        enemy: &mut Enemy,
        grid: &Grid,
        towers: &[(usize, usize, usize, f32, f32)],
        dt: f32,
        new_projectiles: &mut Vec<Projectile>,
        direct_hits: &mut Vec<(usize, f32, f32, f32)>,
        emp_pulses: &mut Vec<(f32, f32, f32, f32, f32)>,
    ) {
        // Find closest tower
        let mut closest_tower: Option<(usize, f32, f32, f32)> = None;
        let mut min_dist = f32::MAX;

        for &(t_id, _, _, tx, ty) in towers {
            let dist = ((tx - enemy.x).powi(2) + (ty - enemy.y).powi(2)).sqrt();
            if dist < min_dist {
                min_dist = dist;
                closest_tower = Some((t_id, tx, ty, dist));
            }
        }

        if let Some((t_id, tx, ty, dist)) = closest_tower {
            if dist <= enemy.attack_range {
                // In range! Face tower and execute attack
                enemy.rotation = (ty - enemy.y).atan2(tx - enemy.x);

                if enemy.current_cooldown <= 0.0 {
                    enemy.current_cooldown = enemy.attack_cooldown;

                    match enemy.variant {
                        EnemyVariant::Bomber => {
                            // Suicide Bomber: detonates!
                            enemy.is_dead = true;
                            direct_hits.push((t_id, enemy.attack_power, enemy.x, enemy.y));
                        }
                        EnemyVariant::EMPDisruptor => {
                            // EMP Shockwave stunning towers in 3.2 radius for 4s
                            emp_pulses.push((enemy.x, enemy.y, 3.2, 4.0, enemy.attack_power));
                        }
                        EnemyVariant::ArtilleryBug => {
                            // Mortar shell lobbed at tower
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
                            // Corrosive acid glob
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
                        _ => {
                            // Siege Brawler / Melee punch directly hits tower!
                            direct_hits.push((t_id, enemy.attack_power, tx, ty));
                        }
                    }
                }
                return; // Hold position while attacking
            }

            // If aggressive melee, move towards closest tower if within aggro range
            if (enemy.variant == EnemyVariant::SiegeBrawler || enemy.variant == EnemyVariant::Bomber) && dist < 5.0 {
                let diff_x = tx - enemy.x;
                let diff_y = ty - enemy.y;
                let step = (enemy.current_speed * dt).min(dist);
                enemy.x += (diff_x / dist) * step;
                enemy.y += (diff_y / dist) * step;
                enemy.rotation = diff_y.atan2(diff_x);
                return;
            }
        }

        // Follow standard maze flow field
        Self::move_walker(enemy, grid, dt);
    }

    fn update_boss(
        enemy: &mut Enemy,
        grid: &Grid,
        towers: &[(usize, usize, usize, f32, f32)],
        dt: f32,
        new_projectiles: &mut Vec<Projectile>,
        new_minions: &mut Vec<SpawnedMinion>,
        direct_hits: &mut Vec<(usize, f32, f32, f32)>,
    ) {
        Self::move_walker(enemy, grid, dt);

        if enemy.current_cooldown <= 0.0 {
            enemy.current_cooldown = enemy.attack_cooldown;

            match enemy.variant {
                EnemyVariant::TitanColossus => {
                    // Stomp shockwave damaging all nearby towers!
                    for &(t_id, _, _, tx, ty) in towers {
                        let dist = ((tx - enemy.x).powi(2) + (ty - enemy.y).powi(2)).sqrt();
                        if dist <= 3.5 {
                            direct_hits.push((t_id, enemy.attack_power * 0.8, tx, ty));
                        }
                    }
                }
                EnemyVariant::Broodmother => {
                    // Hatch minions and spit acid
                    new_minions.push(SpawnedMinion {
                        variant: EnemyVariant::Swarm,
                        x: enemy.x - 0.4,
                        y: enemy.y - 0.4,
                    });
                    new_minions.push(SpawnedMinion {
                        variant: EnemyVariant::Swarm,
                        x: enemy.x + 0.4,
                        y: enemy.y + 0.4,
                    });

                    // Spit acid at closest tower
                    for &(t_id, _, _, tx, ty) in towers {
                        let dist = ((tx - enemy.x).powi(2) + (ty - enemy.y).powi(2)).sqrt();
                        if dist <= 4.0 {
                            new_projectiles.push(Projectile::new_enemy_acid(
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
                EnemyVariant::AnnihilatorMech => {
                    // Annihilator heavy mortar blast
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
        let is_overdrive = self.abilities.overdrive_timer > 0.0;
        let cooldown_dt = if is_overdrive { dt * 2.0 } else { dt };
        let dmg_mult = if is_overdrive { 1.35 } else { 1.0 };

        // Step A: Aegis Towers repair nearby towers
        for i in 0..self.towers.len() {
            if self.towers[i].tower_type == TowerType::Aegis {
                let ax = self.towers[i].world_x;
                let ay = self.towers[i].world_y;
                let range = self.towers[i].range;
                let repair_amount = match self.towers[i].tier {
                    1 => 14.0 * dt,
                    2 => 28.0 * dt,
                    _ => 45.0 * dt,
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

        // Step B: Offensive Towers attack enemies
        let mut new_projs = Vec::new();

        for tower in self.towers.iter_mut() {
            if tower.stun_timer > 0.0 {
                tower.stun_timer -= dt;
                continue;
            }

            if tower.tower_type == TowerType::Aegis {
                continue;
            }

            if tower.cooldown > 0.0 {
                tower.cooldown -= cooldown_dt;
            }

            let mut target_idx: Option<usize> = None;
            let mut best_score = -9999999.0;
            let goal_x = self.grid.goal_x as f32;
            let goal_y = self.grid.goal_y as f32;

            for (idx, enemy) in self.enemies.iter().enumerate() {
                if enemy.is_dead {
                    continue;
                }
                let dist = ((enemy.x - tower.world_x).powi(2) + (enemy.y - tower.world_y).powi(2)).sqrt();
                if dist <= tower.range {
                    let score = match tower.targeting_priority {
                        crate::tower::TargetingPriority::First => {
                            let goal_dist = ((enemy.x - goal_x).powi(2) + (enemy.y - goal_y).powi(2)).sqrt();
                            1000.0 - goal_dist
                        }
                        crate::tower::TargetingPriority::Strongest => enemy.hp + enemy.shield_hp,
                        crate::tower::TargetingPriority::Weakest => 100000.0 - (enemy.hp + enemy.shield_hp),
                        crate::tower::TargetingPriority::Closest => 1000.0 - dist,
                    };
                    if score > best_score {
                        best_score = score;
                        target_idx = Some(idx);
                    }
                }
            }

            if let Some(t_idx) = target_idx {
                let enemy = &mut self.enemies[t_idx];
                tower.target_id = enemy.id as i32;
                tower.rotation = (enemy.y - tower.world_y).atan2(enemy.x - tower.world_x);
                let actual_damage = tower.damage * dmg_mult;

                if tower.tower_type == TowerType::Laser {
                    if tower.laser_target_id == enemy.id as i32 {
                        tower.laser_ramp_time += dt;
                    } else {
                        tower.laser_target_id = enemy.id as i32;
                        tower.laser_ramp_time = 0.0;
                    }
                    let ramp_factor = 1.0 + (tower.laser_ramp_time * 0.8).min(3.0);
                    let beam_damage = actual_damage * ramp_factor * dt;
                    enemy.take_damage(beam_damage);
                    tower.total_damage += beam_damage;
                    self.total_damage_dealt += beam_damage;
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
                                actual_damage,
                            ));
                        }
                        TowerType::Cannon => {
                            let splash = 1.3 + (tower.tier as f32 * 0.3);
                            new_projs.push(Projectile::new_cannon_shell(
                                0,
                                tower.world_x,
                                tower.world_y,
                                enemy.x,
                                enemy.y,
                                actual_damage,
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
                                actual_damage,
                                slow,
                                dur,
                            ));
                        }
                        TowerType::Tesla => {
                            let max_chains = 2 + (tower.tier as usize * 2);
                            let mut chained_targets = Vec::new();
                            let mut current_tx = tower.world_x;
                            let mut current_ty = tower.world_y;
                            let mut dmg = actual_damage;

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
                                    self.total_damage_dealt += dmg;
                                    if target_enemy.is_dead {
                                        tower.kills += 1;
                                    }
                                    chained_targets.push(target_enemy.id);
                                    current_tx = nx;
                                    current_ty = ny;
                                    dmg *= 0.8;
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
                                actual_damage,
                                actual_damage * 0.7,
                            ));
                        }
                        TowerType::Sniper => {
                            enemy.take_damage(actual_damage);
                            tower.total_damage += actual_damage;
                            self.total_damage_dealt += actual_damage;
                            if enemy.is_dead {
                                tower.kills += 1;
                            }
                            self.visual_events.push(VisualEvent {
                                event_type: 1,
                                x: tower.world_x,
                                y: tower.world_y,
                                target_x: enemy.x,
                                target_y: enemy.y,
                                value: 4.0,
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
                            event_type: 0,
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
                        // Directly damages targeted tower!
                        if proj.target_tower_id != -1 {
                            if let Some(t) = self.towers.iter_mut().find(|t| t.id == proj.target_tower_id as usize) {
                                t.take_damage(proj.damage);
                            }
                        }
                        // Plus splash damage to any other towers within radius
                        for tower in self.towers.iter_mut() {
                            if tower.id != proj.target_tower_id as usize {
                                let d = ((tower.world_x - proj.x).powi(2) + (tower.world_y - proj.y).powi(2)).sqrt();
                                if d <= proj.splash_radius {
                                    tower.take_damage(proj.damage * 0.7);
                                }
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

        self.enemies.retain(|e| !e.is_dead);
        self.projectiles.retain(|p| !p.is_expired);

        // Remove destroyed towers and recalculate flow field
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

    pub fn current_surge_tier(&self) -> u32 {
        if self.wave_manager.current_wave > 5 {
            (self.wave_manager.current_wave - 5) / 4
        } else {
            0
        }
    }

    pub fn set_tower_targeting(&mut self, tower_id: usize, priority: u8) -> bool {
        if let Some(t) = self.towers.iter_mut().find(|t| t.id == tower_id) {
            t.targeting_priority = crate::tower::TargetingPriority::from_u8(priority);
            true
        } else {
            false
        }
    }

    pub fn trigger_ability(&mut self, ability_type: u8, target_x: f32, target_y: f32) -> bool {
        match ability_type {
            0 => {
                // Orbital EMP Blast
                if self.abilities.emp_cooldown > 0.0 {
                    return false;
                }
                self.abilities.emp_cooldown = self.abilities.emp_max_cooldown;

                for enemy in self.enemies.iter_mut() {
                    if !enemy.is_dead {
                        enemy.slow_factor = 0.0;
                        enemy.slow_timer = 3.5;
                    }
                }

                for tower in self.towers.iter_mut() {
                    tower.stun_timer = 0.0;
                }

                self.visual_events.push(VisualEvent {
                    event_type: 3,
                    x: 12.0,
                    y: 7.0,
                    target_x: 0.0,
                    target_y: 0.0,
                    value: 25.0,
                });
                true
            }
            1 => {
                // Kinetic Orbital Strike
                if self.abilities.strike_cooldown > 0.0 {
                    return false;
                }
                self.abilities.strike_cooldown = self.abilities.strike_max_cooldown;

                let tx = target_x.clamp(0.0, 24.0);
                let ty = target_y.clamp(0.0, 14.0);
                let radius = 3.5;
                let strike_damage = 950.0;

                for enemy in self.enemies.iter_mut() {
                    if enemy.is_dead {
                        continue;
                    }
                    let d = ((enemy.x - tx).powi(2) + (enemy.y - ty).powi(2)).sqrt();
                    if d <= radius {
                        let falloff = 1.0 - (d / radius) * 0.4;
                        let dmg = strike_damage * falloff;
                        enemy.take_damage(dmg);
                        self.total_damage_dealt += dmg;
                    }
                }

                self.visual_events.push(VisualEvent {
                    event_type: 1,
                    x: tx,
                    y: 0.0,
                    target_x: tx,
                    target_y: ty,
                    value: 6.0,
                });
                self.visual_events.push(VisualEvent {
                    event_type: 0,
                    x: tx,
                    y: ty,
                    target_x: 0.0,
                    target_y: 0.0,
                    value: radius,
                });
                true
            }
            2 => {
                // Emergency Bastion Overdrive
                if self.abilities.overdrive_cooldown > 0.0 {
                    return false;
                }
                self.abilities.overdrive_cooldown = self.abilities.overdrive_max_cooldown;
                self.abilities.overdrive_timer = 8.0;

                for tower in self.towers.iter_mut() {
                    let repair_amount = tower.max_hp * 0.35;
                    tower.hp = (tower.hp + repair_amount).min(tower.max_hp);
                    self.visual_events.push(VisualEvent {
                        event_type: 5,
                        x: tower.world_x,
                        y: tower.world_y,
                        target_x: 0.0,
                        target_y: 0.0,
                        value: 50.0,
                    });
                }
                true
            }
            _ => false,
        }
    }
}

pub struct SpawnedMinion {
    pub variant: EnemyVariant,
    pub x: f32,
    pub y: f32,
}
