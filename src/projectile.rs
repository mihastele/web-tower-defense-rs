#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum ProjectileType {
    // Player tower projectiles
    Bullet = 0,
    CannonShell = 1,
    IceShard = 2,
    TeslaArc = 3,
    FlameParticle = 4,
    SniperRay = 5,
    LaserBeam = 6,

    // Enemy projectiles
    EnemyMortar = 7,
    EnemyAcid = 8,
    EnemyRocket = 9,
}

#[derive(Clone, Debug)]
pub struct Projectile {
    pub id: usize,
    pub proj_type: ProjectileType,
    pub x: f32,
    pub y: f32,
    pub target_x: f32,
    pub target_y: f32,
    pub speed: f32,
    pub damage: f32,
    pub splash_radius: f32,
    pub target_enemy_id: i32,
    pub target_tower_id: i32,
    pub slow_factor: f32,
    pub slow_duration: f32,
    pub burn_dps: f32,
    pub burn_duration: f32,
    pub is_expired: bool,
    pub lifetime: f32,
    pub max_lifetime: f32,
}

impl Projectile {
    pub fn new_bullet(id: usize, x: f32, y: f32, target_enemy_id: i32, target_x: f32, target_y: f32, damage: f32) -> Self {
        Self {
            id,
            proj_type: ProjectileType::Bullet,
            x,
            y,
            target_x,
            target_y,
            speed: 12.0,
            damage,
            splash_radius: 0.0,
            target_enemy_id,
            target_tower_id: -1,
            slow_factor: 1.0,
            slow_duration: 0.0,
            burn_dps: 0.0,
            burn_duration: 0.0,
            is_expired: false,
            lifetime: 0.0,
            max_lifetime: 2.0,
        }
    }

    pub fn new_cannon_shell(id: usize, x: f32, y: f32, target_x: f32, target_y: f32, damage: f32, splash: f32) -> Self {
        Self {
            id,
            proj_type: ProjectileType::CannonShell,
            x,
            y,
            target_x,
            target_y,
            speed: 7.5,
            damage,
            splash_radius: splash,
            target_enemy_id: -1,
            target_tower_id: -1,
            slow_factor: 1.0,
            slow_duration: 0.0,
            burn_dps: 0.0,
            burn_duration: 0.0,
            is_expired: false,
            lifetime: 0.0,
            max_lifetime: 3.0,
        }
    }

    pub fn new_ice_shard(id: usize, x: f32, y: f32, target_enemy_id: i32, target_x: f32, target_y: f32, damage: f32, slow: f32, dur: f32) -> Self {
        Self {
            id,
            proj_type: ProjectileType::IceShard,
            x,
            y,
            target_x,
            target_y,
            speed: 9.0,
            damage,
            splash_radius: 1.2,
            target_enemy_id,
            target_tower_id: -1,
            slow_factor: slow,
            slow_duration: dur,
            burn_dps: 0.0,
            burn_duration: 0.0,
            is_expired: false,
            lifetime: 0.0,
            max_lifetime: 2.0,
        }
    }

    pub fn new_flame(id: usize, x: f32, y: f32, target_x: f32, target_y: f32, damage: f32, burn_dps: f32) -> Self {
        Self {
            id,
            proj_type: ProjectileType::FlameParticle,
            x,
            y,
            target_x,
            target_y,
            speed: 6.0,
            damage,
            splash_radius: 0.9,
            target_enemy_id: -1,
            target_tower_id: -1,
            slow_factor: 1.0,
            slow_duration: 0.0,
            burn_dps,
            burn_duration: 3.0,
            is_expired: false,
            lifetime: 0.0,
            max_lifetime: 0.6,
        }
    }

    pub fn new_enemy_mortar(id: usize, x: f32, y: f32, target_tower_id: i32, target_x: f32, target_y: f32, damage: f32) -> Self {
        Self {
            id,
            proj_type: ProjectileType::EnemyMortar,
            x,
            y,
            target_x,
            target_y,
            speed: 5.0,
            damage,
            splash_radius: 1.0,
            target_enemy_id: -1,
            target_tower_id,
            slow_factor: 1.0,
            slow_duration: 0.0,
            burn_dps: 0.0,
            burn_duration: 0.0,
            is_expired: false,
            lifetime: 0.0,
            max_lifetime: 3.0,
        }
    }

    pub fn new_enemy_acid(id: usize, x: f32, y: f32, target_tower_id: i32, target_x: f32, target_y: f32, damage: f32) -> Self {
        Self {
            id,
            proj_type: ProjectileType::EnemyAcid,
            x,
            y,
            target_x,
            target_y,
            speed: 6.5,
            damage,
            splash_radius: 0.5,
            target_enemy_id: -1,
            target_tower_id,
            slow_factor: 1.0,
            slow_duration: 0.0,
            burn_dps: 10.0,
            burn_duration: 2.5,
            is_expired: false,
            lifetime: 0.0,
            max_lifetime: 2.5,
        }
    }
}
