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
        };

        // Add a few decorative scenery obstacles on the borders that leave ample open field
        grid.recalculate_flow_field();
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

    pub fn can_place_tower(&mut self, x: usize, y: usize, active_walkers: &[(f32, f32)]) -> bool {
        if !self.is_valid(x, y) {
            return false;
        }
        // Cannot place on spawn or goal
        if (x == self.spawn_x && y == self.spawn_y) || (x == self.goal_x && y == self.goal_y) {
            return false;
        }
        // Cannot place if not empty
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
                        // Allow end goal even if temporarily checked
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
                        // For a walker at (unx, uny), the step toward the goal is (cx, cy)
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
