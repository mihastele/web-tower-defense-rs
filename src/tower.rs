#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum TargetingPriority {
    First = 0,
    Strongest = 1,
    Weakest = 2,
    Closest = 3,
}

impl TargetingPriority {
    pub fn from_u8(v: u8) -> Self {
        match v {
            0 => TargetingPriority::First,
            1 => TargetingPriority::Strongest,
            2 => TargetingPriority::Weakest,
            3 => TargetingPriority::Closest,
            _ => TargetingPriority::First,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum TowerType {
    Gatling = 0,
    Cannon = 1,
    Cryo = 2,
    Tesla = 3,
    Flamethrower = 4,
    Sniper = 5,
    Laser = 6,
    Aegis = 7,
}

impl TowerType {
    pub fn from_u8(v: u8) -> Self {
        match v {
            0 => TowerType::Gatling,
            1 => TowerType::Cannon,
            2 => TowerType::Cryo,
            3 => TowerType::Tesla,
            4 => TowerType::Flamethrower,
            5 => TowerType::Sniper,
            6 => TowerType::Laser,
            7 => TowerType::Aegis,
            _ => TowerType::Gatling,
        }
    }

    pub fn base_cost(&self) -> u32 {
        match self {
            TowerType::Gatling => 100,
            TowerType::Cannon => 140,
            TowerType::Cryo => 130,
            TowerType::Tesla => 175,
            TowerType::Flamethrower => 160,
            TowerType::Sniper => 200,
            TowerType::Laser => 220,
            TowerType::Aegis => 150,
        }
    }

    pub fn base_hp(&self) -> f32 {
        match self {
            TowerType::Gatling => 350.0,
            TowerType::Cannon => 500.0,
            TowerType::Cryo => 400.0,
            TowerType::Tesla => 450.0,
            TowerType::Flamethrower => 600.0,
            TowerType::Sniper => 300.0,
            TowerType::Laser => 420.0,
            TowerType::Aegis => 700.0,
        }
    }

    pub fn base_range(&self) -> f32 {
        match self {
            TowerType::Gatling => 3.2,
            TowerType::Cannon => 3.8,
            TowerType::Cryo => 2.8,
            TowerType::Tesla => 3.4,
            TowerType::Flamethrower => 2.5,
            TowerType::Sniper => 6.5,
            TowerType::Laser => 3.5,
            TowerType::Aegis => 3.0,
        }
    }

    pub fn base_damage(&self) -> f32 {
        match self {
            TowerType::Gatling => 24.0,
            TowerType::Cannon => 75.0,
            TowerType::Cryo => 15.0,
            TowerType::Tesla => 48.0,
            TowerType::Flamethrower => 18.0,
            TowerType::Sniper => 160.0,
            TowerType::Laser => 35.0, // ramps up
            TowerType::Aegis => 0.0,
        }
    }

    pub fn base_fire_rate(&self) -> f32 {
        match self {
            TowerType::Gatling => 4.0,  // shots per sec
            TowerType::Cannon => 0.75, // slow boom
            TowerType::Cryo => 1.2,
            TowerType::Tesla => 1.1,
            TowerType::Flamethrower => 6.0, // continuous stream
            TowerType::Sniper => 0.5,       // high caliber reload
            TowerType::Laser => 10.0,       // ticks per sec
            TowerType::Aegis => 1.0,        // repair pulse
        }
    }
}

#[derive(Clone, Debug)]
pub struct Tower {
    pub id: usize,
    pub gx: usize,
    pub gy: usize,
    pub world_x: f32,
    pub world_y: f32,
    pub tower_type: TowerType,
    pub tier: u8, // 1, 2, 3
    pub hp: f32,
    pub max_hp: f32,
    pub range: f32,
    pub damage: f32,
    pub fire_rate: f32,
    pub cooldown: f32,
    pub rotation: f32,
    pub target_id: i32,
    pub kills: u32,
    pub total_damage: f32,
    pub cost: u32,
    pub total_invested: u32,
    pub stun_timer: f32,
    pub laser_target_id: i32,
    pub laser_ramp_time: f32,
    pub targeting_priority: TargetingPriority,
    pub shot_counter: u32,
    pub special_cooldown: f32,
}

impl Tower {
    pub fn new(id: usize, gx: usize, gy: usize, t_type: TowerType) -> Self {
        let base_hp = t_type.base_hp();
        let cost = t_type.base_cost();
        Self {
            id,
            gx,
            gy,
            world_x: gx as f32 + 0.5,
            world_y: gy as f32 + 0.5,
            tower_type: t_type,
            tier: 1,
            hp: base_hp,
            max_hp: base_hp,
            range: t_type.base_range(),
            damage: t_type.base_damage(),
            fire_rate: t_type.base_fire_rate(),
            cooldown: 0.0,
            rotation: 0.0,
            target_id: -1,
            kills: 0,
            total_damage: 0.0,
            cost,
            total_invested: cost,
            stun_timer: 0.0,
            laser_target_id: -1,
            laser_ramp_time: 0.0,
            targeting_priority: if t_type == TowerType::Sniper {
                TargetingPriority::Strongest
            } else {
                TargetingPriority::First
            },
            shot_counter: 0,
            special_cooldown: 0.0,
        }
    }

    pub fn upgrade_cost(&self) -> u32 {
        if self.tier >= 3 {
            return 0;
        }
        match self.tier {
            1 => (self.cost as f32 * 1.5) as u32,
            2 => (self.cost as f32 * 2.5) as u32,
            _ => 0,
        }
    }

    pub fn upgrade(&mut self) -> bool {
        if self.tier >= 3 {
            return false;
        }
        let cost = self.upgrade_cost();
        self.tier += 1;
        self.total_invested += cost;

        // Upgrade stats
        match self.tier {
            2 => {
                self.max_hp *= 1.6;
                self.hp = self.max_hp;
                self.damage *= 1.7;
                self.range *= 1.2;
                self.fire_rate *= 1.25;
            }
            3 => {
                self.max_hp *= 1.8;
                self.hp = self.max_hp;
                self.damage *= 2.2;
                self.range *= 1.25;
                self.fire_rate *= 1.35;
            }
            _ => {}
        }
        true
    }

    pub fn repair_cost(&self) -> u32 {
        if self.hp >= self.max_hp {
            return 0;
        }
        let missing_pct = (self.max_hp - self.hp) / self.max_hp;
        ((self.total_invested as f32 * 0.35 * missing_pct) as u32).max(10)
    }

    pub fn repair(&mut self) {
        self.hp = self.max_hp;
    }

    pub fn sell_refund(&self) -> u32 {
        let hp_ratio = (self.hp / self.max_hp).max(0.2);
        (self.total_invested as f32 * 0.7 * hp_ratio) as u32
    }

    pub fn take_damage(&mut self, amount: f32) -> bool {
        self.hp -= amount;
        self.hp <= 0.0
    }
}
