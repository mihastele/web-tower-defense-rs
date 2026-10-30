pub mod enemy;
pub mod game;
pub mod grid;
pub mod projectile;
pub mod tower;
pub mod wave;

use game::Game;
use grid::{CellState, GRID_HEIGHT, GRID_WIDTH};
use tower::TowerType;

static mut GAME_INSTANCE: Option<Game> = None;

// Reusable export buffers
static mut HEADER_BUFFER: [f32; 24] = [0.0; 24];
static mut OBSTACLES_BUFFER: [f32; GRID_WIDTH * GRID_HEIGHT] = [0.0; GRID_WIDTH * GRID_HEIGHT];
static mut PATH_BUFFER: [f32; 512 * 2] = [0.0; 1024];
static mut TOWERS_BUFFER: [f32; 256 * 14] = [0.0; 3584];
static mut ENEMIES_BUFFER: [f32; 512 * 14] = [0.0; 7168];
static mut PROJECTILES_BUFFER: [f32; 512 * 6] = [0.0; 3072];
static mut EVENTS_BUFFER: [f32; 256 * 6] = [0.0; 1536];

fn get_game() -> &'static mut Game {
    unsafe {
        let ptr = std::ptr::addr_of_mut!(GAME_INSTANCE);
        if (*ptr).is_none() {
            *ptr = Some(Game::new());
        }
        (*ptr).as_mut().unwrap()
    }
}

#[no_mangle]
pub extern "C" fn game_init() {
    unsafe {
        GAME_INSTANCE = Some(Game::new());
    }
    sync_buffers();
}

#[no_mangle]
pub extern "C" fn game_reset() {
    get_game().reset();
    sync_buffers();
}

#[no_mangle]
pub extern "C" fn game_load_level(level: i32) -> i32 {
    if level < 1 || level > 5 {
        return 0;
    }
    if get_game().load_level(level as usize) {
        sync_buffers();
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn game_get_current_level() -> i32 {
    get_game().current_level as i32
}

#[no_mangle]
pub extern "C" fn game_get_max_unlocked_level() -> i32 {
    get_game().max_unlocked_level as i32
}

#[no_mangle]
pub extern "C" fn game_update(dt: f32) {
    let g = get_game();
    g.update(dt);
    sync_buffers();
}

#[no_mangle]
pub extern "C" fn game_can_place_tower(gx: i32, gy: i32) -> i32 {
    if gx < 0 || gy < 0 {
        return 0;
    }
    if get_game().can_place_tower(gx as usize, gy as usize) {
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn game_place_tower(gx: i32, gy: i32, tower_type: i32) -> i32 {
    if gx < 0 || gy < 0 || tower_type < 0 || tower_type > 7 {
        return -1;
    }
    let t_type = TowerType::from_u8(tower_type as u8);
    get_game().place_tower(gx as usize, gy as usize, t_type)
}

#[no_mangle]
pub extern "C" fn game_upgrade_tower(tower_id: i32) -> i32 {
    if tower_id < 0 {
        return -1;
    }
    get_game().upgrade_tower(tower_id as usize)
}

#[no_mangle]
pub extern "C" fn game_repair_tower(tower_id: i32) -> i32 {
    if tower_id < 0 {
        return -1;
    }
    get_game().repair_tower(tower_id as usize)
}

#[no_mangle]
pub extern "C" fn game_sell_tower(tower_id: i32) -> i32 {
    if tower_id < 0 {
        return -1;
    }
    get_game().sell_tower(tower_id as usize)
}

#[no_mangle]
pub extern "C" fn game_start_next_wave() -> i32 {
    if get_game().start_next_wave() {
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn game_add_gold(amount: i32) {
    get_game().gold += amount;
}

#[no_mangle]
pub extern "C" fn game_set_lives(lives: i32) {
    get_game().lives = lives;
    get_game().max_lives = lives;
}

#[no_mangle]
pub extern "C" fn game_trigger_ability(ability_type: i32, target_x: f32, target_y: f32) -> i32 {
    if ability_type < 0 || ability_type > 2 {
        return 0;
    }
    if get_game().trigger_ability(ability_type as u8, target_x, target_y) {
        sync_buffers();
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn game_set_tower_targeting(tower_id: i32, priority: i32) -> i32 {
    if tower_id < 0 || priority < 0 || priority > 3 {
        return 0;
    }
    if get_game().set_tower_targeting(tower_id as usize, priority as u8) {
        sync_buffers();
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn game_spawn_enemy(variant: i32) {
    let g = get_game();
    let id = g.alloc_id();
    let var = match variant {
        0 => enemy::EnemyVariant::Scout,
        1 => enemy::EnemyVariant::Armored,
        2 => enemy::EnemyVariant::Phantom,
        3 => enemy::EnemyVariant::Healer,
        4 => enemy::EnemyVariant::Swarm,
        5 => enemy::EnemyVariant::SiegeBrawler,
        6 => enemy::EnemyVariant::ArtilleryBug,
        7 => enemy::EnemyVariant::Bomber,
        8 => enemy::EnemyVariant::EMPDisruptor,
        9 => enemy::EnemyVariant::AcidSpitter,
        10 => enemy::EnemyVariant::TitanColossus,
        11 => enemy::EnemyVariant::Broodmother,
        _ => enemy::EnemyVariant::AnnihilatorMech,
    };
    let sx = g.grid.spawn_x as f32 + 0.5;
    let sy = g.grid.spawn_y as f32 + 0.5;
    let enemy = enemy::Enemy::new(id, var, 1.0, 0, sx, sy);
    g.enemies.push(enemy);
    sync_buffers();
}

fn sync_buffers() {
    let g = get_game();
    unsafe {
        // Header (24 floats)
        HEADER_BUFFER[0] = g.gold as f32;
        HEADER_BUFFER[1] = g.lives as f32;
        HEADER_BUFFER[2] = g.max_lives as f32;
        HEADER_BUFFER[3] = g.score as f32;
        HEADER_BUFFER[4] = g.wave_manager.current_wave as f32;
        HEADER_BUFFER[5] = if g.wave_manager.is_wave_active { 1.0 } else { 0.0 };
        HEADER_BUFFER[6] = g.wave_manager.time_until_next_wave;
        HEADER_BUFFER[7] = if g.game_over { 1.0 } else { 0.0 };
        HEADER_BUFFER[8] = if g.victory { 1.0 } else { 0.0 };
        HEADER_BUFFER[9] = g.towers.len() as f32;
        HEADER_BUFFER[10] = g.enemies.len() as f32;
        HEADER_BUFFER[11] = g.projectiles.len() as f32;
        HEADER_BUFFER[12] = g.visual_events.len() as f32;
        HEADER_BUFFER[13] = g.grid.current_path.len() as f32;
        HEADER_BUFFER[14] = g.total_enemies_killed as f32;
        HEADER_BUFFER[15] = g.current_surge_tier() as f32; // Surge tier level!
        HEADER_BUFFER[16] = g.current_level as f32;
        HEADER_BUFFER[17] = g.max_unlocked_level as f32;
        HEADER_BUFFER[18] = if g.level_completed { 1.0 } else { 0.0 };
        HEADER_BUFFER[19] = (g.grid.spawn_x * 100 + g.grid.spawn_y) as f32;
        HEADER_BUFFER[20] = g.abilities.emp_cooldown;
        HEADER_BUFFER[21] = g.abilities.strike_cooldown;
        HEADER_BUFFER[22] = g.abilities.overdrive_cooldown;
        HEADER_BUFFER[23] = if g.abilities.overdrive_timer > 0.0 { 1.0 } else { 0.0 };

        // Obstacles
        for y in 0..GRID_HEIGHT {
            for x in 0..GRID_WIDTH {
                let idx = y * GRID_WIDTH + x;
                OBSTACLES_BUFFER[idx] = if matches!(g.grid.cells[idx], CellState::Obstacle) { 1.0 } else { 0.0 };
            }
        }

        // Path
        for (i, &(px, py)) in g.grid.current_path.iter().enumerate().take(512) {
            PATH_BUFFER[i * 2] = px as f32;
            PATH_BUFFER[i * 2 + 1] = py as f32;
        }

        // Towers (14 floats each)
        for (i, t) in g.towers.iter().enumerate().take(256) {
            let offset = i * 14;
            TOWERS_BUFFER[offset] = t.id as f32;
            TOWERS_BUFFER[offset + 1] = t.gx as f32;
            TOWERS_BUFFER[offset + 2] = t.gy as f32;
            TOWERS_BUFFER[offset + 3] = t.world_x;
            TOWERS_BUFFER[offset + 4] = t.world_y;
            TOWERS_BUFFER[offset + 5] = t.tower_type as u8 as f32;
            TOWERS_BUFFER[offset + 6] = t.tier as f32;
            TOWERS_BUFFER[offset + 7] = t.hp;
            TOWERS_BUFFER[offset + 8] = t.max_hp;
            TOWERS_BUFFER[offset + 9] = t.range;
            TOWERS_BUFFER[offset + 10] = t.rotation;
            TOWERS_BUFFER[offset + 11] = t.stun_timer;
            TOWERS_BUFFER[offset + 12] = t.targeting_priority as u8 as f32;
            TOWERS_BUFFER[offset + 13] = t.kills as f32;
        }

        // Enemies (14 floats each)
        for (i, e) in g.enemies.iter().enumerate().take(512) {
            let offset = i * 14;
            ENEMIES_BUFFER[offset] = e.id as f32;
            ENEMIES_BUFFER[offset + 1] = e.variant as u8 as f32;
            ENEMIES_BUFFER[offset + 2] = e.category as u8 as f32;
            ENEMIES_BUFFER[offset + 3] = e.x;
            ENEMIES_BUFFER[offset + 4] = e.y;
            ENEMIES_BUFFER[offset + 5] = e.hp;
            ENEMIES_BUFFER[offset + 6] = e.max_hp;
            ENEMIES_BUFFER[offset + 7] = e.current_speed;
            ENEMIES_BUFFER[offset + 8] = e.rotation;
            ENEMIES_BUFFER[offset + 9] = e.slow_factor;
            ENEMIES_BUFFER[offset + 10] = e.burn_timer;
            ENEMIES_BUFFER[offset + 11] = e.elite_affix as u8 as f32;
            ENEMIES_BUFFER[offset + 12] = e.shield_hp;
            ENEMIES_BUFFER[offset + 13] = e.max_shield_hp;
        }

        // Projectiles
        for (i, p) in g.projectiles.iter().enumerate().take(512) {
            let offset = i * 6;
            PROJECTILES_BUFFER[offset] = p.proj_type as u8 as f32;
            PROJECTILES_BUFFER[offset + 1] = p.x;
            PROJECTILES_BUFFER[offset + 2] = p.y;
            PROJECTILES_BUFFER[offset + 3] = p.target_x;
            PROJECTILES_BUFFER[offset + 4] = p.target_y;
            PROJECTILES_BUFFER[offset + 5] = p.splash_radius;
        }

        // Visual events
        for (i, ev) in g.visual_events.iter().enumerate().take(256) {
            let offset = i * 6;
            EVENTS_BUFFER[offset] = ev.event_type as f32;
            EVENTS_BUFFER[offset + 1] = ev.x;
            EVENTS_BUFFER[offset + 2] = ev.y;
            EVENTS_BUFFER[offset + 3] = ev.target_x;
            EVENTS_BUFFER[offset + 4] = ev.target_y;
            EVENTS_BUFFER[offset + 5] = ev.value;
        }
    }
}

// Memory pointers
#[no_mangle]
pub extern "C" fn get_header_ptr() -> *const f32 {
    std::ptr::addr_of!(HEADER_BUFFER) as *const f32
}

#[no_mangle]
pub extern "C" fn get_obstacles_ptr() -> *const f32 {
    std::ptr::addr_of!(OBSTACLES_BUFFER) as *const f32
}

#[no_mangle]
pub extern "C" fn get_path_ptr() -> *const f32 {
    std::ptr::addr_of!(PATH_BUFFER) as *const f32
}

#[no_mangle]
pub extern "C" fn get_towers_ptr() -> *const f32 {
    std::ptr::addr_of!(TOWERS_BUFFER) as *const f32
}

#[no_mangle]
pub extern "C" fn get_enemies_ptr() -> *const f32 {
    std::ptr::addr_of!(ENEMIES_BUFFER) as *const f32
}

#[no_mangle]
pub extern "C" fn get_projectiles_ptr() -> *const f32 {
    std::ptr::addr_of!(PROJECTILES_BUFFER) as *const f32
}

#[no_mangle]
pub extern "C" fn get_events_ptr() -> *const f32 {
    std::ptr::addr_of!(EVENTS_BUFFER) as *const f32
}
