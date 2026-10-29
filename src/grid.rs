use std::collections::VecDeque;

pub const GRID_WIDTH: usize = 24;
pub const GRID_HEIGHT: usize = 14;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CellState {
    Empty,
    Obstacle,
    Tower(usize), // Tower ID
}

pub struct Grid {
    pub width: usize,
    pub height: usize,
    pub cells: [CellState; GRID_WIDTH * GRID_HEIGHT],
    pub spawn_x: usize,
    pub spawn_y: usize,
    pub goal_x: usize,
    pub goal_y: usize,
    pub flow_field: [(i8, i8); GRID_WIDTH * GRID_HEIGHT],
    pub current_path: Vec<(usize, usize)>,
    pub current_level: usize,
}

impl Grid {
    pub fn new() -> Self {
        let mut grid = Self {
            width: GRID_WIDTH,
            height: GRID_HEIGHT,
            cells: [CellState::Empty; GRID_WIDTH * GRID_HEIGHT],
            spawn_x: 0,
            spawn_y: GRID_HEIGHT / 2,
            goal_x: GRID_WIDTH - 1,
            goal_y: GRID_HEIGHT / 2,
            flow_field: [(0, 0); GRID_WIDTH * GRID_HEIGHT],
            current_path: Vec::new(),
            current_level: 1,
        };

        grid.load_level(1);
        grid
    }

    pub fn idx(&self, x: usize, y: usize) -> usize {
        y * self.width + x
    }

    pub fn is_valid(&self, x: usize, y: usize) -> bool {
        x < self.width && y < self.height
    }

    pub fn is_passable(&self, x: usize, y: usize) -> bool {
        if !self.is_valid(x, y) {
            return false;
        }
        matches!(self.cells[self.idx(x, y)], CellState::Empty)
    }

    pub fn load_level(&mut self, level: usize) {
        self.current_level = level;
        // Reset all cells to Empty
        self.cells = [CellState::Empty; GRID_WIDTH * GRID_HEIGHT];

        match level {
            1 => {
                // Level 1: "Frontier Canyon" - Open tactical arena
                self.spawn_x = 0;
                self.spawn_y = 7;
                self.goal_x = 23;
                self.goal_y = 7;

                // A few decorative rock pillars that leave wide corridors
                self.set_obstacle(6, 3);
                self.set_obstacle(6, 10);
                self.set_obstacle(17, 3);
                self.set_obstacle(17, 10);
            }
            2 => {
                // Level 2: "Circuit Labyrinth" - Serpentine S-Curve
                // Path goes top -> right -> down -> left -> down -> right to goal!
                self.spawn_x = 0;
                self.spawn_y = 2;
                self.goal_x = 23;
                self.goal_y = 11;

                // Top divider wall (y=4, x=0 to 19, opening at x=20..23)
                for x in 0..19 {
                    self.set_obstacle(x, 4);
                }
                // Bottom divider wall (y=9, x=5 to 23, opening at x=0..4)
                for x in 5..24 {
                    self.set_obstacle(x, 9);
                }
            }
            3 => {
                // Level 3: "Serpentine Slalom" - Vertical Zigzag
                self.spawn_x = 0;
                self.spawn_y = 1;
                self.goal_x = 23;
                self.goal_y = 12;

                // Column 1 (x=6, y=0..10, opening at bottom y=11..13)
                for y in 0..10 {
                    self.set_obstacle(6, y);
                }
                // Column 2 (x=12, y=4..13, opening at top y=0..3)
                for y in 4..14 {
                    self.set_obstacle(12, y);
                }
                // Column 3 (x=18, y=0..10, opening at bottom y=11..13)
                for y in 0..10 {
                    self.set_obstacle(18, y);
                }
            }
            4 => {
                // Level 4: "Citadel Gauntlet" - Perimeter Spiral to Central Core!
                self.spawn_x = 0;
                self.spawn_y = 0;
                self.goal_x = 12;
                self.goal_y = 6;

                // Spiral walls guiding enemies clockwise into center:
                // Wall dividing upper loop from core
                for x in 2..21 {
                    self.set_obstacle(x, 2);
                }
                // Wall dividing right side
                for y in 3..11 {
                    self.set_obstacle(21, y);
                }
                // Wall dividing bottom
                for x in 4..21 {
                    self.set_obstacle(x, 11);
                }
                // Wall dividing left side loop
                for y in 5..11 {
                    self.set_obstacle(4, y);
                }
                // Core enclosure leaving entrance from right
                for x in 7..14 {
                    self.set_obstacle(x, 4);
                    self.set_obstacle(x, 8);
                }
                self.set_obstacle(7, 5);
                self.set_obstacle(7, 6);
                self.set_obstacle(7, 7);
            }
            _ => {
                // Default fallback to Level 1
                self.spawn_x = 0;
                self.spawn_y = 7;
                self.goal_x = 23;
                self.goal_y = 7;
            }
        }

        self.recalculate_flow_field();
    }

    fn set_obstacle(&mut self, x: usize, y: usize) {
        if self.is_valid(x, y) {
            let idx = self.idx(x, y);
            self.cells[idx] = CellState::Obstacle;
        }
    }

    pub fn can_place_tower(&mut self, x: usize, y: usize, active_walkers: &[(f32, f32)]) -> bool {
        if !self.is_valid(x, y) {
            return false;
        }
        // Cannot place on spawn or goal
        if (x == self.spawn_x && y == self.spawn_y) || (x == self.goal_x && y == self.goal_y) {
            return false;
        }
        // Cannot place if not empty (e.g. already obstacle or tower)
        let idx = self.idx(x, y);
        if !matches!(self.cells[idx], CellState::Empty) {
            return false;
        }

        // Temporarily place a mock obstacle
        self.cells[idx] = CellState::Obstacle;

        // Verify that spawn can still reach goal
        let has_path = self.check_path_exists(self.spawn_x, self.spawn_y, self.goal_x, self.goal_y);

        // Verify that all active walkers can still reach the goal
        let mut all_walkers_reach = true;
        if has_path {
            for &(wx, wy) in active_walkers {
                let gx = wx.round().max(0.0).min((GRID_WIDTH - 1) as f32) as usize;
                let gy = wy.round().max(0.0).min((GRID_HEIGHT - 1) as f32) as usize;
                if !self.check_path_exists(gx, gy, self.goal_x, self.goal_y) {
                    all_walkers_reach = false;
                    break;
                }
            }
        }

        // Restore cell state
        self.cells[idx] = CellState::Empty;

        has_path && all_walkers_reach
    }

    pub fn check_path_exists(&self, start_x: usize, start_y: usize, end_x: usize, end_y: usize) -> bool {
        if start_x == end_x && start_y == end_y {
            return true;
        }

        let mut visited = [false; GRID_WIDTH * GRID_HEIGHT];
        let mut queue = VecDeque::with_capacity(GRID_WIDTH * GRID_HEIGHT);

        let start_idx = self.idx(start_x, start_y);
        visited[start_idx] = true;
        queue.push_back((start_x, start_y));

        let dirs: [(isize, isize); 4] = [(1, 0), (-1, 0), (0, 1), (0, -1)];

        while let Some((cx, cy)) = queue.pop_front() {
            if cx == end_x && cy == end_y {
                return true;
            }

            for (dx, dy) in dirs {
                let nx = cx as isize + dx;
                let ny = cy as isize + dy;

                if nx >= 0 && nx < self.width as isize && ny >= 0 && ny < self.height as isize {
                    let unx = nx as usize;
                    let uny = ny as usize;
                    let n_idx = self.idx(unx, uny);

                    if !visited[n_idx] {
                        let passable = matches!(self.cells[n_idx], CellState::Empty) || (unx == end_x && uny == end_y);
                        if passable {
                            visited[n_idx] = true;
                            queue.push_back((unx, uny));
                        }
                    }
                }
            }
        }

        false
    }

    pub fn recalculate_flow_field(&mut self) {
        // Reverse BFS from Goal to all reachable cells
        let mut visited = [false; GRID_WIDTH * GRID_HEIGHT];
        let mut parent = [None; GRID_WIDTH * GRID_HEIGHT];
        let mut queue = VecDeque::with_capacity(GRID_WIDTH * GRID_HEIGHT);

        let goal_idx = self.idx(self.goal_x, self.goal_y);
        visited[goal_idx] = true;
        queue.push_back((self.goal_x, self.goal_y));

        let dirs: [(isize, isize); 4] = [(1, 0), (-1, 0), (0, 1), (0, -1)];

        while let Some((cx, cy)) = queue.pop_front() {
            for (dx, dy) in dirs {
                let nx = cx as isize + dx;
                let ny = cy as isize + dy;

                if nx >= 0 && nx < self.width as isize && ny >= 0 && ny < self.height as isize {
                    let unx = nx as usize;
                    let uny = ny as usize;
                    let n_idx = self.idx(unx, uny);

                    if !visited[n_idx] && (matches!(self.cells[n_idx], CellState::Empty) || (unx == self.spawn_x && uny == self.spawn_y)) {
                        visited[n_idx] = true;
                        parent[n_idx] = Some((cx as i8 - unx as i8, cy as i8 - uny as i8));
                        queue.push_back((unx, uny));
                    }
                }
            }
        }

        for i in 0..(GRID_WIDTH * GRID_HEIGHT) {
            self.flow_field[i] = parent[i].unwrap_or((0, 0));
        }

        // Trace the primary path from spawn to goal for visualization
        self.current_path.clear();
        let mut curr_x = self.spawn_x;
        let mut curr_y = self.spawn_y;
        self.current_path.push((curr_x, curr_y));

        let mut steps = 0;
        while (curr_x != self.goal_x || curr_y != self.goal_y) && steps < 500 {
            let idx = self.idx(curr_x, curr_y);
            let (dx, dy) = self.flow_field[idx];
            if dx == 0 && dy == 0 {
                break;
            }
            curr_x = (curr_x as isize + dx as isize) as usize;
            curr_y = (curr_y as isize + dy as isize) as usize;
            self.current_path.push((curr_x, curr_y));
            steps += 1;
        }
    }
}
