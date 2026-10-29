// Main Game Coordinator: WebAssembly Bridge, Input Handling, Loop

class GameApp {
    constructor() {
        this.wasm = null;
        this.memory = null;
        this.sprites = null;
        this.renderer = null;
        this.sound = null;
        this.ui = null;

        this.hoverTile = null;
        this.lastTime = performance.now();
        this.state = {
            gold: 450,
            lives: 20,
            maxLives: 20,
            score: 0,
            wave: 0,
            isWaveActive: false,
            timeUntilNextWave: 10,
            gameOver: false,
            victory: false,
            towersCount: 0,
            enemiesCount: 0,
            projectilesCount: 0,
            eventsCount: 0,
            pathCount: 0,
            towers: [],
            enemies: [],
            projectiles: [],
            events: [],
            path: []
        };
    }

    async init() {
        console.log("Initializing Web Tower Defense...");

        // 1. Initialize procedural sound engine
        this.sound = new SoundEngine();

        // 2. Initialize and generate all procedural pixel-art sprites
        this.sprites = new SpriteGenerator();
        this.sprites.init();

        // 3. Setup canvas & renderer
        const canvas = document.getElementById('game-canvas');
        this.renderer = new GameRenderer(canvas, this.sprites);

        // 4. Setup UI controller
        this.ui = new UIController(this);
        this.ui.init();

        // 5. Load WebAssembly simulation core
        await this.loadWasm();

        // 6. Setup mouse & canvas interaction
        this.setupInput(canvas);

        // 7. Start main game loop
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));

        console.log("Game successfully initialized and running!");
    }

    async loadWasm() {
        try {
            const response = await fetch('wasm/web_tower_defense_wasm.wasm');
            const bytes = await response.arrayBuffer();
            const wasmModule = await WebAssembly.instantiate(bytes, {});
            this.wasm = wasmModule.instance.exports;
            this.memory = this.wasm.memory;

            // Initialize simulation in Rust
            this.wasm.game_init();
            this.syncState();
            console.log("WebAssembly core engine loaded successfully!");
        } catch (err) {
            console.error("Failed to load WebAssembly module:", err);
            alert("Could not load WebAssembly module. Ensure the page is served over HTTP/HTTPS.");
        }
    }

    setupInput(canvas) {
        // Window resize and orientation change
        window.addEventListener('resize', () => {
            this.renderer.resize();
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.renderer.resize();
                this.renderer.resetCamera();
            }, 250);
        });

        // Helper to check and update hover tile
        const updateHoverFromScreen = (sx, sy) => {
            const world = this.renderer.screenToWorld(sx, sy);
            const gx = world.gx;
            const gy = world.gy;

            if (gx >= 0 && gx < this.renderer.gridWidth && gy >= 0 && gy < this.renderer.gridHeight) {
                let isValid = false;
                let range = 3.2;

                if (this.ui.selectedTowerType !== null) {
                    isValid = this.wasm.game_can_place_tower(gx, gy) === 1;
                    const ranges = [3.2, 3.8, 2.8, 3.4, 2.5, 6.5, 3.5, 3.0];
                    range = ranges[this.ui.selectedTowerType] || 3.2;
                }

                this.hoverTile = { x: gx, y: gy, isValid, range };
            } else {
                this.hoverTile = null;
            }
        };

        const handleActionAt = (gx, gy) => {
            this.sound.init();

            // Case A: Placing a new tower
            if (this.ui.selectedTowerType !== null) {
                const res = this.wasm.game_place_tower(gx, gy, this.ui.selectedTowerType);
                if (res > 0) {
                    this.sound.playBuild();
                    this.renderer.addFloatingText(gx + 0.5, gy + 0.5, "BUILT!", "#10b981");
                    this.syncState();
                    const placed = this.state.towers.find(t => t.id === res);
                    if (placed) this.ui.selectPlacedTower(placed);
                } else if (res === -1) {
                    this.sound.playError();
                    this.renderer.addFloatingText(gx + 0.5, gy + 0.5, "PATH BLOCKED!", "#ef4444");
                } else if (res === -2) {
                    this.sound.playError();
                    this.renderer.addFloatingText(gx + 0.5, gy + 0.5, "NEED GOLD!", "#f59e0b");
                }
                return;
            }

            // Case B: Selecting an existing tower on grid
            const clickedTower = this.state.towers.find(t => t.gx === gx && t.gy === gy);
            if (clickedTower) {
                this.ui.selectPlacedTower(clickedTower);
            } else {
                this.ui.selectedPlacedTower = null;
                this.ui.updateDetailPanel();
            }
        };

        // --- MOUSE CONTROLS ---
        let isMousePanning = false;
        let lastMouseX = 0, lastMouseY = 0;
        let mouseMoved = false;

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            if (isMousePanning) {
                const dx = e.clientX - lastMouseX;
                const dy = e.clientY - lastMouseY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mouseMoved = true;
                this.renderer.camera.x += dx;
                this.renderer.camera.y += dy;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            } else {
                updateHoverFromScreen(sx, sy);
            }
        });

        canvas.addEventListener('mousedown', (e) => {
            // Drag on right-click, middle click, or left-click without selected tower
            if (e.button === 1 || e.button === 2 || (e.button === 0 && this.ui.selectedTowerType === null)) {
                isMousePanning = true;
                mouseMoved = false;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (isMousePanning) {
                isMousePanning = false;
            }
        });

        canvas.addEventListener('mouseleave', () => {
            this.hoverTile = null;
        });

        canvas.addEventListener('click', (e) => {
            if (mouseMoved) return; // Was a pan drag, not a tap
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const world = this.renderer.screenToWorld(sx, sy);
            if (world.gx >= 0 && world.gx < this.renderer.gridWidth && world.gy >= 0 && world.gy < this.renderer.gridHeight) {
                handleActionAt(world.gx, world.gy);
            }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.15 : 0.87;
            this.renderer.zoomAt(factor, sx, sy);
        }, { passive: false });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // --- TOUCH & MOBILE CONTROLS (Pan with 1 thumb, pinch to zoom with 2) ---
        let lastTouchDist = 0;
        let lastTouchX = 0, lastTouchY = 0;
        let touchStartGx = -1, touchStartGy = -1;
        let touchHasPanned = false;

        canvas.addEventListener('touchstart', (e) => {
            this.sound.init();
            const rect = canvas.getBoundingClientRect();

            if (e.touches.length === 1) {
                const t = e.touches[0];
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;
                touchHasPanned = false;

                const sx = t.clientX - rect.left;
                const sy = t.clientY - rect.top;
                const world = this.renderer.screenToWorld(sx, sy);
                touchStartGx = world.gx;
                touchStartGy = world.gy;

                updateHoverFromScreen(sx, sy);
            } else if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                lastTouchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                touchHasPanned = true; // Pinching is not a tap
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent native browser scrolling while interacting with map
            const rect = canvas.getBoundingClientRect();

            if (e.touches.length === 1) {
                const t = e.touches[0];
                const dx = t.clientX - lastTouchX;
                const dy = t.clientY - lastTouchY;

                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    touchHasPanned = true;
                }

                // Pan the map with thumb
                this.renderer.camera.x += dx;
                this.renderer.camera.y += dy;
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;

                const sx = t.clientX - rect.left;
                const sy = t.clientY - rect.top;
                updateHoverFromScreen(sx, sy);
            } else if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                if (lastTouchDist > 0) {
                    const factor = dist / lastTouchDist;
                    const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
                    const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
                    this.renderer.zoomAt(factor, midX, midY);
                }
                lastTouchDist = dist;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                if (!touchHasPanned && touchStartGx >= 0 && touchStartGy >= 0) {
                    // Clean tap without drag: execute build or select!
                    handleActionAt(touchStartGx, touchStartGy);
                }
                lastTouchDist = 0;
            }
        });

        // Mobile On-Screen Zoom Controls
        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');
        const btnZoomReset = document.getElementById('btn-zoom-reset');

        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => {
                const cx = (canvas.width / (window.devicePixelRatio || 1)) / 2;
                const cy = (canvas.height / (window.devicePixelRatio || 1)) / 2;
                this.renderer.zoomAt(1.25, cx, cy);
            });
        }
        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => {
                const cx = (canvas.width / (window.devicePixelRatio || 1)) / 2;
                const cy = (canvas.height / (window.devicePixelRatio || 1)) / 2;
                this.renderer.zoomAt(0.8, cx, cy);
            });
        }
        if (btnZoomReset) {
            btnZoomReset.addEventListener('click', () => {
                this.renderer.resetCamera();
            });
        }
    }

    startNextWave() {
        if (!this.wasm) return;
        const res = this.wasm.game_start_next_wave();
        if (res === 1) {
            this.sound.playBossAlarm();
            this.renderer.addFloatingText(12, 7, "WAVE STARTED!", "#38bdf8");
            this.syncState();
        }
    }

    upgradeTower(towerId) {
        if (!this.wasm) return;
        const res = this.wasm.game_upgrade_tower(towerId);
        if (res > 0) {
            this.sound.playUpgrade();
            const tower = this.state.towers.find(t => t.id === towerId);
            if (tower) {
                this.renderer.addFloatingText(tower.gx + 0.5, tower.gy + 0.5, `TIER ${res}!`, "#c084fc");
            }
            this.syncState();
            const updated = this.state.towers.find(t => t.id === towerId);
            if (updated) this.ui.selectPlacedTower(updated);
        } else {
            this.sound.playError();
        }
    }

    repairTower(towerId) {
        if (!this.wasm) return;
        const res = this.wasm.game_repair_tower(towerId);
        if (res === 1) {
            this.sound.playRepair();
            const tower = this.state.towers.find(t => t.id === towerId);
            if (tower) {
                this.renderer.addFloatingText(tower.gx + 0.5, tower.gy + 0.5, "REPAIRED!", "#10b981");
            }
            this.syncState();
            const updated = this.state.towers.find(t => t.id === towerId);
            if (updated) this.ui.selectPlacedTower(updated);
        } else {
            this.sound.playError();
        }
    }

    sellTower(towerId) {
        if (!this.wasm) return;
        const res = this.wasm.game_sell_tower(towerId);
        if (res > 0) {
            this.sound.playSell();
            this.renderer.addFloatingText(12, 7, `+${res} Gold`, "#fbbf24");
            this.ui.selectedPlacedTower = null;
            this.ui.updateDetailPanel();
            this.syncState();
        }
    }

    loadLevel(levelNum) {
        if (!this.wasm) return;
        const res = this.wasm.game_load_level(levelNum);
        if (res === 1) {
            this.sound.playBuild();
            this.ui.selectedPlacedTower = null;
            this.ui.selectedTowerType = null;
            this.ui.updateDetailPanel();
            this.syncState();
            this.renderer.addFloatingText(12, 7, `LEVEL ${levelNum} LOADED`, "#38bdf8");
        } else {
            this.sound.playError();
        }
    }

    reset() {
        if (!this.wasm) return;
        this.wasm.game_reset();
        this.ui.selectedPlacedTower = null;
        this.ui.selectedTowerType = null;
        this.ui.updateDetailPanel();
        this.syncState();
    }

    syncState() {
        if (!this.wasm) return;

        // 1. Read Header (20 floats)
        const headerPtr = this.wasm.get_header_ptr();
        const header = new Float32Array(this.memory.buffer, headerPtr, 20);

        this.state.gold = Math.round(header[0]);
        this.state.lives = Math.round(header[1]);
        this.state.maxLives = Math.round(header[2]);
        this.state.score = Math.round(header[3]);
        this.state.wave = Math.round(header[4]);
        this.state.isWaveActive = header[5] > 0.5;
        this.state.timeUntilNextWave = header[6];
        this.state.gameOver = header[7] > 0.5;
        this.state.victory = header[8] > 0.5;
        this.state.towersCount = Math.round(header[9]);
        this.state.enemiesCount = Math.round(header[10]);
        this.state.projectilesCount = Math.round(header[11]);
        this.state.eventsCount = Math.round(header[12]);
        this.state.pathCount = Math.round(header[13]);
        this.state.currentLevel = Math.round(header[16]) || 1;
        this.state.maxUnlockedLevel = Math.round(header[17]) || 1;
        this.state.levelCompleted = header[18] > 0.5;

        // Unpack spawn coordinates
        const spawnPacked = Math.round(header[19]);
        const sx = Math.floor(spawnPacked / 100);
        const sy = spawnPacked % 100;
        this.state.spawn = { x: sx, y: sy };

        // Goal is the last coordinate of the current path if available, or default
        if (this.state.path && this.state.path.length > 0) {
            this.state.goal = this.state.path[this.state.path.length - 1];
        } else {
            this.state.goal = { x: 23, y: 7 };
        }

        // Save unlock progress to localStorage
        const savedMaxLevel = parseInt(localStorage.getItem('cyber_bastion_max_level') || '1', 10);
        if (this.state.maxUnlockedLevel > savedMaxLevel) {
            localStorage.setItem('cyber_bastion_max_level', this.state.maxUnlockedLevel.toString());
            this.ui.showLevelUnlockedToast(this.state.maxUnlockedLevel);
        }

        // 2. Read Obstacles Buffer
        const obsPtr = this.wasm.get_obstacles_ptr();
        this.state.obstacles = new Float32Array(this.memory.buffer, obsPtr, 24 * 14);

        // 3. Read Path
        const pathPtr = this.wasm.get_path_ptr();
        const pathRaw = new Float32Array(this.memory.buffer, pathPtr, this.state.pathCount * 2);
        this.state.path = [];
        for (let i = 0; i < this.state.pathCount; i++) {
            this.state.path.push({ x: pathRaw[i * 2], y: pathRaw[i * 2 + 1] });
        }
        if (this.state.path.length > 0) {
            this.state.goal = this.state.path[this.state.path.length - 1];
        }

        // 3. Read Towers (12 floats each)
        const towersPtr = this.wasm.get_towers_ptr();
        const towersRaw = new Float32Array(this.memory.buffer, towersPtr, this.state.towersCount * 12);
        this.state.towers = [];
        for (let i = 0; i < this.state.towersCount; i++) {
            const off = i * 12;
            this.state.towers.push({
                id: Math.round(towersRaw[off]),
                gx: Math.round(towersRaw[off + 1]),
                gy: Math.round(towersRaw[off + 2]),
                worldX: towersRaw[off + 3],
                worldY: towersRaw[off + 4],
                type: Math.round(towersRaw[off + 5]),
                tier: Math.round(towersRaw[off + 6]),
                hp: towersRaw[off + 7],
                maxHp: towersRaw[off + 8],
                range: towersRaw[off + 9],
                rotation: towersRaw[off + 10],
                stunTimer: towersRaw[off + 11]
            });
        }

        // 4. Read Enemies (11 floats each)
        const enemiesPtr = this.wasm.get_enemies_ptr();
        const enemiesRaw = new Float32Array(this.memory.buffer, enemiesPtr, this.state.enemiesCount * 11);
        this.state.enemies = [];
        for (let i = 0; i < this.state.enemiesCount; i++) {
            const off = i * 11;
            this.state.enemies.push({
                id: Math.round(enemiesRaw[off]),
                variant: Math.round(enemiesRaw[off + 1]),
                category: Math.round(enemiesRaw[off + 2]),
                x: enemiesRaw[off + 3],
                y: enemiesRaw[off + 4],
                hp: enemiesRaw[off + 5],
                maxHp: enemiesRaw[off + 6],
                speed: enemiesRaw[off + 7],
                rotation: enemiesRaw[off + 8],
                slowFactor: enemiesRaw[off + 9],
                burnTimer: enemiesRaw[off + 10]
            });
        }

        // 5. Read Projectiles (6 floats each)
        const projPtr = this.wasm.get_projectiles_ptr();
        const projRaw = new Float32Array(this.memory.buffer, projPtr, this.state.projectilesCount * 6);
        this.state.projectiles = [];
        for (let i = 0; i < this.state.projectilesCount; i++) {
            const off = i * 6;
            this.state.projectiles.push({
                type: Math.round(projRaw[off]),
                x: projRaw[off + 1],
                y: projRaw[off + 2],
                targetX: projRaw[off + 3],
                targetY: projRaw[off + 4],
                splashRadius: projRaw[off + 5]
            });
        }

        // 6. Read Visual Events (6 floats each)
        const eventsPtr = this.wasm.get_events_ptr();
        const eventsRaw = new Float32Array(this.memory.buffer, eventsPtr, this.state.eventsCount * 6);
        this.state.events = [];
        for (let i = 0; i < this.state.eventsCount; i++) {
            const off = i * 6;
            const ev = {
                type: Math.round(eventsRaw[off]),
                x: eventsRaw[off + 1],
                y: eventsRaw[off + 2],
                targetX: eventsRaw[off + 3],
                targetY: eventsRaw[off + 4],
                value: eventsRaw[off + 5]
            };
            this.state.events.push(ev);

            // Play corresponding sounds
            if (ev.type === 0) this.sound.playExplosion(ev.value);
            else if (ev.type === 1) this.sound.playLaser();
            else if (ev.type === 2) this.sound.playTesla();
        }

        // If a tower was selected, refresh its reference
        if (this.ui.selectedPlacedTower) {
            const fresh = this.state.towers.find(t => t.id === this.ui.selectedPlacedTower.id);
            if (fresh) {
                this.ui.selectedPlacedTower = fresh;
            } else {
                this.ui.selectedPlacedTower = null; // Tower was destroyed
                this.ui.updateDetailPanel();
            }
        }
    }

    loop(currentTime) {
        const rawDt = (currentTime - this.lastTime) / 1000.0;
        this.lastTime = currentTime;

        // Cap dt to avoid large physics jumps during tab switches
        const dt = Math.min(rawDt, 0.1);

        if (this.wasm && !this.ui.isPaused) {
            const effectiveDt = dt * this.ui.gameSpeed;
            this.wasm.game_update(effectiveDt);
            this.syncState();
        }

        // Update UI HUD
        this.ui.updateHUD(this.state);

        // Render game view
        this.renderer.render(
            this.state,
            this.hoverTile,
            this.ui.selectedTowerType,
            this.ui.selectedPlacedTower,
            dt
        );

        requestAnimationFrame((t) => this.loop(t));
    }
}

// Bootstrap once window loads
window.addEventListener('DOMContentLoaded', () => {
    const app = new GameApp();
    app.init();
    window.gameApp = app;
});
