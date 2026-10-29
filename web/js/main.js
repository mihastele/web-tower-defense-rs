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
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;

            const gx = Math.floor(mx / this.renderer.cellSize);
            const gy = Math.floor(my / this.renderer.cellSize);

            if (gx >= 0 && gx < this.renderer.gridWidth && gy >= 0 && gy < this.renderer.gridHeight) {
                let isValid = false;
                let range = 3.2;

                if (this.ui.selectedTowerType !== null) {
                    // Check placement validity via WebAssembly!
                    isValid = this.wasm.game_can_place_tower(gx, gy) === 1;
                    const info = this.ui.towerTypes[this.ui.selectedTowerType];
                    const ranges = [3.2, 3.8, 2.8, 3.4, 2.5, 6.5, 3.5, 3.0];
                    range = ranges[this.ui.selectedTowerType] || 3.2;
                }

                this.hoverTile = { x: gx, y: gy, isValid, range };
            } else {
                this.hoverTile = null;
            }
        });

        canvas.addEventListener('mouseleave', () => {
            this.hoverTile = null;
        });

        canvas.addEventListener('click', (e) => {
            this.sound.init(); // Unlock AudioContext on click

            if (!this.hoverTile) return;
            const { x: gx, y: gy } = this.hoverTile;

            // Case A: Placing a new tower
            if (this.ui.selectedTowerType !== null) {
                const res = this.wasm.game_place_tower(gx, gy, this.ui.selectedTowerType);
                if (res > 0) {
                    this.sound.playBuild();
                    this.renderer.addFloatingText(gx + 0.5, gy + 0.5, "BUILT!", "#10b981");
                    // Keep placing or select placed tower
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
        });
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

        // 1. Read Header (16 floats)
        const headerPtr = this.wasm.get_header_ptr();
        const header = new Float32Array(this.memory.buffer, headerPtr, 16);

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

        // 2. Read Path
        const pathPtr = this.wasm.get_path_ptr();
        const pathRaw = new Float32Array(this.memory.buffer, pathPtr, this.state.pathCount * 2);
        this.state.path = [];
        for (let i = 0; i < this.state.pathCount; i++) {
            this.state.path.push({ x: pathRaw[i * 2], y: pathRaw[i * 2 + 1] });
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
