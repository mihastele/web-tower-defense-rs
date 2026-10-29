#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum EnemyCategory {
    Walker = 0,
    TowerAttacker = 1,
    Boss = 2,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum EnemyVariant {
    // Walkers
    Scout = 0,
    Armored = 1,
    Phantom = 2,
    Healer = 3,
    Swarm = 4,

    // Tower Attackers
    SiegeBrawler = 5,
    ArtilleryBug = 6,
    Bomber = 7,
    EMPDisruptor = 8,
    AcidSpitter = 9,

    // Bosses
    TitanColossus = 10,
    Broodmother = 11,
    AnnihilatorMech = 12,
}

impl EnemyVariant {
    pub fn category(&self) -> EnemyCategory {
        match self {
            EnemyVariant::Scout
            | EnemyVariant::Armored
            | EnemyVariant::Phantom
            | EnemyVariant::Healer
            | EnemyVariant::Swarm => EnemyCategory::Walker,

            EnemyVariant::SiegeBrawler
            | EnemyVariant::ArtilleryBug
            | EnemyVariant::Bomber
            | EnemyVariant::EMPDisruptor
            | EnemyVariant::AcidSpitter => EnemyCategory::TowerAttacker,

            EnemyVariant::TitanColossus
            | EnemyVariant::Broodmother
            | EnemyVariant::AnnihilatorMech => EnemyCategory::Boss,
        }
    }

    pub fn base_stats(&self) -> (f32, f32, f32, u32, f32) {
        // (hp, speed, attack_power, gold_bounty, attack_range)
        match self {
            EnemyVariant::Scout => (70.0, 2.2, 0.0, 12, 0.0),
            EnemyVariant::Armored => (320.0, 1.0, 0.0, 25, 0.0),
            EnemyVariant::Phantom => (140.0, 1.9, 0.0, 20, 0.0),
            EnemyVariant::Healer => (160.0, 1.3, 0.0, 22, 0.0),
            EnemyVariant::Swarm => (45.0, 2.4, 0.0, 8, 0.0),

            // Attackers
            EnemyVariant::SiegeBrawler => (280.0, 1.2, 45.0, 28, 1.4),
            EnemyVariant::ArtilleryBug => (170.0, 1.1, 35.0, 26, 3.8),
            EnemyVariant::Bomber => (110.0, 2.1, 160.0, 22, 1.3), // Suicide boom
            EnemyVariant::EMPDisruptor => (220.0, 1.2, 15.0, 30, 3.2),
            EnemyVariant::AcidSpitter => (190.0, 1.3, 28.0, 24, 3.2),

            // Bosses
            EnemyVariant::TitanColossus => (2400.0, 0.7, 85.0, 180, 2.0),
            EnemyVariant::Broodmother => (2000.0, 0.8, 60.0, 190, 3.2),
            EnemyVariant::AnnihilatorMech => (3200.0, 0.65, 100.0, 250, 3.8),
        }
    }
}

#[derive(Clone, Debug)]
pub struct Enemy {
    pub id: usize,
    pub variant: EnemyVariant,
    pub category: EnemyCategory,
    pub x: f32,
    pub y: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub base_speed: f32,
    pub current_speed: f32,
    pub attack_power: f32,
    pub attack_range: f32,
    pub attack_cooldown: f32,
    pub current_cooldown: f32,
    pub gold_bounty: u32,
    pub score_value: u32,
    pub target_tower_id: i32,
    pub reached_goal: bool,
    pub is_dead: bool,
    pub slow_timer: f32,
    pub slow_factor: f32,
    pub burn_timer: f32,
    pub burn_dps: f32,
    pub special_ability_timer: f32,
    pub rotation: f32,
}

impl Enemy {
    pub fn new(id: usize, variant: EnemyVariant, wave_multiplier: f32, spawn_x: f32, spawn_y: f32) -> Self {
        let (base_hp, speed, atk, gold, atk_range) = variant.base_stats();
        let scaled_hp = base_hp * wave_multiplier;
        let scaled_atk = atk * (1.0 + (wave_multiplier - 1.0) * 0.4);
        let category = variant.category();

        Self {
            id,
            variant,
            category,
            x: spawn_x,
            y: spawn_y,
            hp: scaled_hp,
            max_hp: scaled_hp,
            base_speed: speed,
            current_speed: speed,
            attack_power: scaled_atk,
            attack_range: atk_range,
            attack_cooldown: match variant {
                EnemyVariant::SiegeBrawler => 1.2,
                EnemyVariant::ArtilleryBug => 2.0,
                EnemyVariant::Bomber => 0.1,
                EnemyVariant::EMPDisruptor => 3.5,
                EnemyVariant::AcidSpitter => 1.6,
                EnemyVariant::TitanColossus => 1.5,
                EnemyVariant::Broodmother => 2.2,
                EnemyVariant::AnnihilatorMech => 2.0,
                _ => 1.0,
            },
            current_cooldown: 0.0,
            gold_bounty: (gold as f32 * (1.0 + (wave_multiplier - 1.0) * 0.1)) as u32,
            score_value: (scaled_hp * 0.5) as u32,
            target_tower_id: -1,
            reached_goal: false,
            is_dead: false,
            slow_timer: 0.0,
            slow_factor: 1.0,
            burn_timer: 0.0,
            burn_dps: 0.0,
            special_ability_timer: 2.0,
            rotation: 0.0,
        }
    }

    pub fn apply_slow(&mut self, factor: f32, duration: f32) {
        if self.variant == EnemyVariant::Phantom {
            // Phantom resists slows
            return;
        }
        self.slow_factor = self.slow_factor.min(factor);
        self.slow_timer = self.slow_timer.max(duration);
    }

    pub fn apply_burn(&mut self, dps: f32, duration: f32) {
        self.burn_dps = self.burn_dps.max(dps);
        self.burn_timer = self.burn_timer.max(duration);
    }

    pub fn take_damage(&mut self, damage: f32) -> bool {
        let actual_damage = if self.variant == EnemyVariant::Armored {
            // Armored takes reduced damage from low attacks
            (damage - 4.0).max(damage * 0.5)
        } else {
            damage
        };

        self.hp -= actual_damage;
        if self.hp <= 0.0 {
            self.hp = 0.0;
            self.is_dead = true;
        }
        self.is_dead
    }

    pub fn update_status(&mut self, dt: f32) {
        // Slow recovery
        if self.slow_timer > 0.0 {
            self.slow_timer -= dt;
            if self.slow_timer <= 0.0 {
                self.slow_factor = 1.0;
            }
        } else {
            self.slow_factor = 1.0;
        }

        // Burn DoT
        if self.burn_timer > 0.0 {
            self.burn_timer -= dt;
            let burn_damage = self.burn_dps * dt;
            self.take_damage(burn_damage);
        }

        // Speed calculation
        self.current_speed = self.base_speed * self.slow_factor;

        // Cooldown tick
        if self.current_cooldown > 0.0 {
            self.current_cooldown -= dt;
        }
        if self.special_ability_timer > 0.0 {
            self.special_ability_timer -= dt;
        }
    }
}
