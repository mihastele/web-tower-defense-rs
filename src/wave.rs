use crate::enemy::EnemyVariant;

pub struct SpawnItem {
    pub variant: EnemyVariant,
    pub delay: f32, // seconds after previous spawn
}

pub struct WaveManager {
    pub current_wave: u32,
    pub is_wave_active: bool,
    pub spawn_queue: Vec<SpawnItem>,
    pub spawn_timer: f32,
    pub time_until_next_wave: f32,
    pub total_enemies_in_wave: usize,
    pub enemies_spawned: usize,
}

impl WaveManager {
    pub fn new() -> Self {
        Self {
            current_wave: 0,
            is_wave_active: false,
            spawn_queue: Vec::new(),
            spawn_timer: 0.0,
            time_until_next_wave: 10.0,
            total_enemies_in_wave: 0,
            enemies_spawned: 0,
        }
    }

    pub fn start_next_wave(&mut self) -> bool {
        if self.is_wave_active {
            return false;
        }

        self.current_wave += 1;
        self.is_wave_active = true;
        self.spawn_timer = 0.5;
        self.enemies_spawned = 0;
        self.spawn_queue = Self::generate_wave_enemies(self.current_wave);
        self.total_enemies_in_wave = self.spawn_queue.len();
        true
    }

    pub fn generate_wave_enemies(wave: u32) -> Vec<SpawnItem> {
        let mut queue = Vec::new();

        match wave {
            1 => {
                // Intro wave: Scouts
                for _ in 0..8 {
                    queue.push(SpawnItem { variant: EnemyVariant::Scout, delay: 1.0 });
                }
            }
            2 => {
                // Swarm + Scouts
                for _ in 0..5 {
                    queue.push(SpawnItem { variant: EnemyVariant::Scout, delay: 0.9 });
                }
                for _ in 0..12 {
                    queue.push(SpawnItem { variant: EnemyVariant::Swarm, delay: 0.35 });
                }
            }
            3 => {
                // Armored introduction
                for _ in 0..3 {
                    queue.push(SpawnItem { variant: EnemyVariant::Armored, delay: 1.8 });
                    queue.push(SpawnItem { variant: EnemyVariant::Scout, delay: 0.7 });
                }
            }
            4 => {
                // FIRST TOWER ATTACKERS: Siege Brawlers!
                for _ in 0..4 {
                    queue.push(SpawnItem { variant: EnemyVariant::SiegeBrawler, delay: 1.6 });
                    queue.push(SpawnItem { variant: EnemyVariant::Scout, delay: 0.6 });
                }
            }
            5 => {
                // BOSS 1: Titan Colossus!
                queue.push(SpawnItem { variant: EnemyVariant::TitanColossus, delay: 1.0 });
                for _ in 0..6 {
                    queue.push(SpawnItem { variant: EnemyVariant::SiegeBrawler, delay: 1.5 });
                    queue.push(SpawnItem { variant: EnemyVariant::Scout, delay: 0.5 });
                }
            }
            6 => {
                // Phantoms + Artillery Bugs (ranged siege)
                for _ in 0..6 {
                    queue.push(SpawnItem { variant: EnemyVariant::Phantom, delay: 1.1 });
                    queue.push(SpawnItem { variant: EnemyVariant::ArtilleryBug, delay: 1.4 });
                }
            }
            7 => {
                // Suicide Bombers + Armored
                for _ in 0..8 {
                    queue.push(SpawnItem { variant: EnemyVariant::Bomber, delay: 1.2 });
                    queue.push(SpawnItem { variant: EnemyVariant::Armored, delay: 1.0 });
                }
            }
            8 => {
                // EMP Disruptors + Healers + Siege
                for _ in 0..5 {
                    queue.push(SpawnItem { variant: EnemyVariant::Healer, delay: 1.5 });
                    queue.push(SpawnItem { variant: EnemyVariant::EMPDisruptor, delay: 1.5 });
                    queue.push(SpawnItem { variant: EnemyVariant::SiegeBrawler, delay: 1.0 });
                }
            }
            9 => {
                // Acid Spitters + Heavy Swarm
                for _ in 0..7 {
                    queue.push(SpawnItem { variant: EnemyVariant::AcidSpitter, delay: 1.2 });
                    queue.push(SpawnItem { variant: EnemyVariant::Phantom, delay: 0.8 });
                    queue.push(SpawnItem { variant: EnemyVariant::Swarm, delay: 0.3 });
                }
            }
            10 => {
                // BOSS 2: Broodmother!
                queue.push(SpawnItem { variant: EnemyVariant::Broodmother, delay: 1.0 });
                for _ in 0..10 {
                    queue.push(SpawnItem { variant: EnemyVariant::AcidSpitter, delay: 1.2 });
                    queue.push(SpawnItem { variant: EnemyVariant::Swarm, delay: 0.3 });
                }
            }
            11..=14 => {
                // Mixed elite waves
                let count: usize = (12 + (wave - 10) * 3) as usize;
                for i in 0..count {
                    let variant = match (i + wave as usize) % 8 {
                        0 => EnemyVariant::SiegeBrawler,
                        1 => EnemyVariant::ArtilleryBug,
                        2 => EnemyVariant::Bomber,
                        3 => EnemyVariant::EMPDisruptor,
                        4 => EnemyVariant::AcidSpitter,
                        5 => EnemyVariant::Armored,
                        6 => EnemyVariant::Healer,
                        _ => EnemyVariant::Phantom,
                    };
                    queue.push(SpawnItem { variant, delay: 0.8_f32.max(1.4 - (wave as f32 * 0.04)) });
                }
            }
            15 => {
                // BOSS 3: Annihilator Mech!
                queue.push(SpawnItem { variant: EnemyVariant::AnnihilatorMech, delay: 1.0 });
                for _ in 0..8 {
                    queue.push(SpawnItem { variant: EnemyVariant::EMPDisruptor, delay: 1.2 });
                    queue.push(SpawnItem { variant: EnemyVariant::SiegeBrawler, delay: 1.0 });
                }
            }
            _ => {
                // Endless scaling waves: Bosses + heavy siege
                let is_boss = wave % 5 == 0;
                if is_boss {
                    let boss_var = match (wave / 5) % 3 {
                        0 => EnemyVariant::AnnihilatorMech,
                        1 => EnemyVariant::TitanColossus,
                        _ => EnemyVariant::Broodmother,
                    };
                    queue.push(SpawnItem { variant: boss_var, delay: 1.0 });
                }
                let total: usize = (16 + (wave - 15) * 2) as usize;
                for i in 0..total {
                    let variant = match (i + wave as usize) % 10 {
                        0 => EnemyVariant::SiegeBrawler,
                        1 => EnemyVariant::ArtilleryBug,
                        2 => EnemyVariant::Bomber,
                        3 => EnemyVariant::EMPDisruptor,
                        4 => EnemyVariant::AcidSpitter,
                        5 => EnemyVariant::Armored,
                        6 => EnemyVariant::Healer,
                        7 => EnemyVariant::Phantom,
                        8 => EnemyVariant::Scout,
                        _ => EnemyVariant::Swarm,
                    };
                    queue.push(SpawnItem { variant, delay: 0.6_f32.max(1.0 - (wave as f32 * 0.02)) });
                }
            }
        }

        queue
    }
}
