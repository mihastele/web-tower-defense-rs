// UI Controller: Manages HUD, Tower Inspection, Bestiary Modal, and Game Controls

class UIController {
    constructor(game) {
        this.game = game;
        this.towerTypes = [
            { id: 0, name: 'Gatling Turret', cost: 100, desc: 'High rate of fire, single target physical.', key: '1' },
            { id: 1, name: 'Heavy Cannon', cost: 140, desc: 'Long range artillery with explosive splash AOE.', key: '2' },
            { id: 2, name: 'Cryo Spire', cost: 130, desc: 'Chills targets, slowing movement speed.', key: '3' },
            { id: 3, name: 'Tesla Coil', cost: 175, desc: 'Chain lightning jumping between up to 6 targets.', key: '4' },
            { id: 4, name: 'Flamethrower', cost: 160, desc: 'Cone of magma inflicting stacking burn DoT.', key: '5' },
            { id: 5, name: 'Sniper Railgun', cost: 200, desc: 'Extreme range, armor-piercing anti-boss shot.', key: '6' },
            { id: 6, name: 'Laser Melter', cost: 220, desc: 'Continuous beam that ramps up damage over time.', key: '7' },
            { id: 7, name: 'Aegis Beacon', cost: 150, desc: 'Support pylon repairing nearby damaged towers.', key: '8' }
        ];

        this.levels = [
            { id: 1, name: 'Lvl 1: Frontier Canyon', desc: 'Open tactical arena' },
            { id: 2, name: 'Lvl 2: Circuit Labyrinth', desc: 'Serpentine double S-curve path' },
            { id: 3, name: 'Lvl 3: Serpentine Slalom', desc: 'Vertical zigzag chokepoints' },
            { id: 4, name: 'Lvl 4: Citadel Gauntlet', desc: 'Perimeter spiral to central core' },
            { id: 5, name: 'Lvl 5: Omega Core', desc: 'The ultimate abyssal bastion with bifurcating energy channels' },
            { id: 6, name: 'Lvl 6: The Singularity Rift', desc: 'Gravitational event horizon arena with orbital baffles' }
        ];

        this.selectedTowerType = null;
        this.selectedPlacedTower = null;
        this.gameSpeed = 1.0;
        this.isPaused = false;
        this.autoStartWaves = true;
    }

    init() {
        this.buildLevelSelector();
        this.buildTowerHotbar();
        this.bindEvents();
    }

    buildLevelSelector() {
        const container = document.getElementById('level-selector-bar');
        if (!container) return;
        container.innerHTML = '';

        this.levels.forEach(lvl => {
            const btn = document.createElement('button');
            btn.className = `level-pill ${lvl.id === 1 ? 'active' : ''}`;
            btn.id = `btn-lvl-${lvl.id}`;
            btn.title = lvl.desc;
            btn.innerHTML = `<span class="lvl-num">${lvl.id}</span> ${lvl.name}`;

            btn.addEventListener('click', () => {
                if (btn.classList.contains('locked')) {
                    alert(`🔒 Level ${lvl.id} is locked! Complete Wave 10 on Level ${lvl.id - 1} to unlock.`);
                    return;
                }
                this.game.loadLevel(lvl.id);
            });

            container.appendChild(btn);
        });
    }

    showLevelUnlockedToast(unlockedLevel) {
        const toast = document.createElement('div');
        toast.className = 'level-unlock-toast';
        toast.innerHTML = `
            <div class="toast-icon">🎉</div>
            <div>
                <strong>LEVEL ${unlockedLevel} UNLOCKED!</strong>
                <p>New challenging path and tactical map now available!</p>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('visible'), 50);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    buildTowerHotbar() {
        const container = document.getElementById('tower-hotbar');
        container.innerHTML = '';

        this.towerTypes.forEach((t) => {
            const btn = document.createElement('button');
            btn.className = 'tower-btn';
            btn.dataset.type = t.id;
            btn.innerHTML = `
                <div class="tower-key">${t.key}</div>
                <div class="tower-icon-box">
                    <canvas id="thumb-tower-${t.id}" width="36" height="36"></canvas>
                </div>
                <div class="tower-info">
                    <div class="tower-name">${t.name}</div>
                    <div class="tower-cost">💰 ${t.cost}</div>
                </div>
            `;

            btn.addEventListener('click', () => {
                if (this.selectedTowerType === t.id) {
                    this.selectedTowerType = null;
                    btn.classList.remove('active');
                } else {
                    this.selectedTowerType = t.id;
                    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
                this.selectedPlacedTower = null;
                this.updateDetailPanel();
            });

            container.appendChild(btn);
        });

        // Render thumbnails into hotbar buttons
        setTimeout(() => this.renderHotbarThumbnails(), 100);
    }

    renderHotbarThumbnails() {
        this.towerTypes.forEach((t) => {
            const canvas = document.getElementById(`thumb-tower-${t.id}`);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const base = this.game.sprites.get(`tower_${t.id}_1_base`);
            const turret = this.game.sprites.get(`tower_${t.id}_1_turret`);
            ctx.clearRect(0, 0, 36, 36);
            if (base) ctx.drawImage(base, 0, 0, 36, 36);
            if (turret) ctx.drawImage(turret, 0, 0, 36, 36);
        });
    }

    bindEvents() {
        // Wave button
        const waveBtn = document.getElementById('btn-next-wave');
        if (waveBtn) {
            waveBtn.addEventListener('click', () => {
                this.game.startNextWave();
            });
        }

        // Speed buttons
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const speed = parseFloat(btn.dataset.speed);
                if (speed === 0) {
                    this.isPaused = true;
                } else {
                    this.isPaused = false;
                    this.gameSpeed = speed;
                }
            });
        });

        // Audio toggles
        const sfxBtn = document.getElementById('btn-toggle-sfx');
        if (sfxBtn) {
            sfxBtn.addEventListener('click', () => {
                this.game.sound.sfxEnabled = !this.game.sound.sfxEnabled;
                sfxBtn.textContent = this.game.sound.sfxEnabled ? '🔊 SFX: ON' : '🔈 SFX: OFF';
            });
        }

        const musicBtn = document.getElementById('btn-toggle-music');
        if (musicBtn) {
            musicBtn.addEventListener('click', () => {
                const on = this.game.sound.toggleMusic();
                musicBtn.textContent = on ? '🎵 Music: ON' : '🔇 Music: OFF';
            });
        }

        // Bestiary modal toggle
        const bestiaryBtn = document.getElementById('btn-open-bestiary');
        const modal = document.getElementById('modal-bestiary');
        const closeBtn = document.getElementById('btn-close-bestiary');

        if (bestiaryBtn && modal) {
            bestiaryBtn.addEventListener('click', () => {
                modal.classList.remove('hidden');
                this.renderBestiary();
            });
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        // Tactical Commander Ability Buttons
        const empBtn = document.getElementById('btn-ability-emp');
        if (empBtn) {
            empBtn.addEventListener('click', () => this.game.triggerAbility(0));
        }
        const strikeBtn = document.getElementById('btn-ability-strike');
        if (strikeBtn) {
            strikeBtn.addEventListener('click', () => this.game.triggerAbility(1));
        }
        const overdriveBtn = document.getElementById('btn-ability-overdrive');
        if (overdriveBtn) {
            overdriveBtn.addEventListener('click', () => this.game.triggerAbility(2));
        }

        // Restart buttons
        document.querySelectorAll('.btn-restart').forEach(btn => {
            btn.addEventListener('click', () => {
                this.game.reset();
                document.getElementById('modal-gameover').classList.add('hidden');
                document.getElementById('modal-victory').classList.add('hidden');
            });
        });

        // Keyboard hotkeys
        window.addEventListener('keydown', (e) => {
            if (e.key >= '1' && e.key <= '8') {
                const idx = parseInt(e.key) - 1;
                const btn = document.querySelectorAll('.tower-btn')[idx];
                if (btn) btn.click();
            } else if (e.key === 'Escape') {
                this.selectedTowerType = null;
                this.selectedPlacedTower = null;
                document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
                this.updateDetailPanel();
            } else if (e.key === ' ') {
                e.preventDefault();
                this.game.startNextWave();
            } else if (e.key === 'q' || e.key === 'Q') {
                this.game.triggerAbility(0);
            } else if (e.key === 'e' || e.key === 'E') {
                this.game.triggerAbility(1);
            } else if (e.key === 'f' || e.key === 'F') {
                this.game.triggerAbility(2);
            } else if (e.key === 'u' || e.key === 'U') {
                if (this.selectedPlacedTower) this.game.upgradeTower(this.selectedPlacedTower.id);
            } else if (e.key === 'r' || e.key === 'R') {
                if (this.selectedPlacedTower) this.game.repairTower(this.selectedPlacedTower.id);
            } else if (e.key === 's' || e.key === 'S') {
                if (this.selectedPlacedTower) this.game.sellTower(this.selectedPlacedTower.id);
            } else if (e.key === 't' || e.key === 'T') {
                if (this.selectedPlacedTower) {
                    const nextP = ((this.selectedPlacedTower.priority || 0) + 1) % 4;
                    this.game.setTowerTargeting(this.selectedPlacedTower.id, nextP);
                }
            }
        });
    }

    updateHUD(state) {
        document.getElementById('hud-gold').textContent = state.gold;
        document.getElementById('hud-lives').textContent = `${state.lives}/${state.maxLives}`;
        document.getElementById('hud-score').textContent = state.score;

        if (state.surgeTier > 0) {
            const surgeRoman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][state.surgeTier - 1] || state.surgeTier;
            const threatPct = Math.round((Math.pow(1.75, state.surgeTier) - 1) * 100);
            document.getElementById('hud-wave').innerHTML = `${state.wave} <span class="surge-badge">SURGE ${surgeRoman} (+${threatPct}%)</span>`;
        } else {
            document.getElementById('hud-wave').textContent = state.wave;
        }

        // Tactical abilities cooldowns
        const cdEmp = document.getElementById('cd-emp');
        const btnEmp = document.getElementById('btn-ability-emp');
        if (cdEmp && btnEmp) {
            const cd = state.abilities ? state.abilities.empCooldown : 0;
            btnEmp.disabled = cd > 0;
            cdEmp.textContent = cd > 0 ? `${cd.toFixed(1)}s` : 'READY';
        }

        const cdStrike = document.getElementById('cd-strike');
        const btnStrike = document.getElementById('btn-ability-strike');
        if (cdStrike && btnStrike) {
            const cd = state.abilities ? state.abilities.strikeCooldown : 0;
            btnStrike.disabled = cd > 0;
            cdStrike.textContent = cd > 0 ? `${cd.toFixed(1)}s` : 'READY';
        }

        const cdOverdrive = document.getElementById('cd-overdrive');
        const btnOverdrive = document.getElementById('btn-ability-overdrive');
        if (cdOverdrive && btnOverdrive) {
            const cd = state.abilities ? state.abilities.overdriveCooldown : 0;
            const isActive = state.abilities ? state.abilities.overdriveActive : false;
            btnOverdrive.disabled = cd > 0 && !isActive;
            btnOverdrive.classList.toggle('active', isActive);
            cdOverdrive.textContent = isActive ? 'ACTIVE!' : (cd > 0 ? `${cd.toFixed(1)}s` : 'READY');
        }

        // Surge Threat Indicator Bar
        const surgeIndicator = document.getElementById('surge-alert-badge');
        if (surgeIndicator) {
            if (state.surgeTier > 0) {
                surgeIndicator.classList.remove('hidden');
                const threatPct = Math.round((Math.pow(1.75, state.surgeTier) - 1) * 100);
                surgeIndicator.textContent = `⚠️ SURGE TIER ${state.surgeTier}: +${threatPct}% HOSTILE THREAT`;
            } else {
                surgeIndicator.classList.add('hidden');
            }
        }

        // Live Boss Encounter Health Bar Overlay
        const bossBar = document.getElementById('boss-hud-bar');
        if (bossBar) {
            const bosses = state.enemies ? state.enemies.filter(e => e.category === 2 && e.hp > 0) : [];
            if (bosses.length > 0) {
                bossBar.classList.remove('hidden');
                const boss = bosses[0];
                const bossNames = {
                    10: 'TITAN COLOSSUS',
                    11: 'BROODMOTHER QUEEN',
                    12: 'ANNIHILATOR DREADNOUGHT'
                };
                const nameEl = document.getElementById('boss-hud-name');
                const affixEl = document.getElementById('boss-hud-affix');
                const countEl = document.getElementById('boss-hud-count');
                const hpFill = document.getElementById('boss-hud-hp-fill');
                const hpText = document.getElementById('boss-hud-hp-text');
                const shieldCont = document.getElementById('boss-hud-shield-container');
                const shieldFill = document.getElementById('boss-hud-shield-fill');

                if (nameEl) nameEl.textContent = bossNames[boss.variant] || 'SUPREME BOSS';
                if (affixEl) {
                    const affixMap = ['', '🛡️ KINETIC BARRIER MUTATION', '⚡ ENRAGED BERSERKER', '💚 REGENERATIVE NANO-SWARM', '⛓️ REINFORCED JUGGERNAUT PLATING'];
                    affixEl.textContent = boss.eliteAffix > 0 ? affixMap[boss.eliteAffix] : '★ SUPREME TITAN CLASS';
                }
                if (countEl) {
                    countEl.textContent = bosses.length > 1 ? `+${bosses.length - 1} OTHER BOSSES` : '';
                }

                const hpPct = Math.min(100, Math.max(0, (boss.hp / boss.maxHp) * 100));
                if (hpFill) hpFill.style.width = `${hpPct}%`;
                if (hpText) hpText.textContent = `${Math.round(boss.hp)} / ${Math.round(boss.maxHp)} (${Math.round(hpPct)}%)`;

                if (shieldCont && shieldFill) {
                    if (boss.maxShieldHp > 0 && boss.shieldHp > 0) {
                        shieldCont.classList.remove('hidden');
                        const sPct = Math.min(100, Math.max(0, (boss.shieldHp / boss.maxShieldHp) * 100));
                        shieldFill.style.width = `${sPct}%`;
                    } else {
                        shieldCont.classList.add('hidden');
                    }
                }
            } else {
                bossBar.classList.add('hidden');
            }
        }

        // Update Level pills
        this.levels.forEach(lvl => {
            const btn = document.getElementById(`btn-lvl-${lvl.id}`);
            if (btn) {
                const isLocked = lvl.id > state.maxUnlockedLevel;
                btn.classList.toggle('active', lvl.id === state.currentLevel);
                btn.classList.toggle('locked', isLocked);
                if (isLocked) {
                    btn.innerHTML = `<span class="lvl-num">🔒</span> ${lvl.name}`;
                } else {
                    btn.innerHTML = `<span class="lvl-num">${lvl.id}</span> ${lvl.name}`;
                }
            }
        });

        // Wave status / countdown
        const waveStatusEl = document.getElementById('wave-status-text');
        const waveBtn = document.getElementById('btn-next-wave');

        if (state.isWaveActive) {
            waveStatusEl.textContent = `Combat in Progress (Enemies: ${state.enemiesCount})`;
            waveStatusEl.style.color = '#ef4444';
            if (waveBtn) {
                waveBtn.disabled = true;
                waveBtn.innerHTML = `⚔️ WAVE IN PROGRESS`;
            }
        } else {
            const timeSec = Math.max(0, Math.ceil(state.timeUntilNextWave));
            const bonus = timeSec * 2;
            waveStatusEl.textContent = `Next Wave in ${timeSec}s`;
            waveStatusEl.style.color = '#10b981';
            if (waveBtn) {
                waveBtn.disabled = false;
                waveBtn.innerHTML = `⚡ CALL EARLY (+${bonus}💰)`;
            }
        }

        // Live real-time update of selected tower upgrade/repair buttons & stats without needing to re-click
        this.updateActiveTowerDetail(state);

        // Live update hotbar affordability
        this.updateHotbarAffordability(state.gold);

        // Check game over
        if (state.gameOver) {
            document.getElementById('modal-gameover').classList.remove('hidden');
            document.getElementById('final-score-lose').textContent = state.score;
            document.getElementById('final-wave-lose').textContent = state.wave;
        }
    }

    updateHotbarAffordability(gold) {
        document.querySelectorAll('.tower-btn').forEach(btn => {
            const typeId = parseInt(btn.dataset.type, 10);
            const t = this.towerTypes[typeId];
            if (!t) return;
            const unaffordable = gold < t.cost;
            btn.classList.toggle('unaffordable', unaffordable);
        });
    }

    updateActiveTowerDetail(state) {
        if (!this.selectedPlacedTower) return;
        const t = this.selectedPlacedTower;
        const info = this.towerTypes[t.type];
        if (!info) return;

        const upgradeCost = t.tier === 1 ? Math.floor(info.cost * 1.5) : (t.tier === 2 ? Math.floor(info.cost * 2.5) : 0);
        const missingHp = Math.max(0, t.maxHp - t.hp);
        const repairCost = missingHp > 0 ? Math.max(10, Math.floor(info.cost * 0.35 * (missingHp / t.maxHp))) : 0;
        const refund = Math.floor(info.cost * 0.7 * Math.max(0.2, t.hp / t.maxHp));

        // Update Upgrade button disabled state in real-time
        const upBtn = document.getElementById('btn-upgrade-tower');
        if (upBtn && t.tier < 3) {
            const canAfford = state.gold >= upgradeCost;
            if (upBtn.disabled !== !canAfford) {
                upBtn.disabled = !canAfford;
            }
        }

        // Update Repair button disabled state and text
        const repBtn = document.getElementById('btn-repair-tower');
        if (repBtn) {
            const canRepair = missingHp > 0 && state.gold >= repairCost;
            if (repBtn.disabled !== !canRepair) {
                repBtn.disabled = !canRepair;
            }
            const expectedText = `🔧 Repair (💰 ${repairCost})`;
            if (repBtn.textContent.trim() !== expectedText.trim()) {
                repBtn.textContent = expectedText;
            }
        }

        // Update Sell button refund
        const sellBtn = document.getElementById('btn-sell-tower');
        if (sellBtn) {
            const expectedSell = `💰 Sell (+${refund})`;
            if (sellBtn.textContent.trim() !== expectedSell.trim()) {
                sellBtn.textContent = expectedSell;
            }
        }

        // Update HP bar & text smoothly
        const hpFill = document.querySelector('.detail-hp-bar .hp-fill');
        const hpText = document.querySelector('.detail-hp-bar .hp-text');
        if (hpFill) {
            const pct = Math.min(100, Math.max(0, (t.hp / t.maxHp) * 100));
            hpFill.style.width = `${pct}%`;
            if (pct < 30) {
                hpFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
            } else if (pct < 65) {
                hpFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
            } else {
                hpFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
            }
        }
        if (hpText) {
            hpText.textContent = `HP: ${Math.round(t.hp)} / ${Math.round(t.maxHp)}`;
        }

        // Update status box
        const statusBox = document.getElementById('detail-stat-status');
        if (statusBox) {
            statusBox.innerHTML = `<strong>Status:</strong> ${t.stunTimer > 0 ? '⚡ Stunned' : 'Active'}`;
        }

        // Update refund stat box
        const refundBox = document.getElementById('detail-stat-refund');
        if (refundBox) {
            refundBox.innerHTML = `<strong>Refund:</strong> 💰 ${refund}`;
        }

        // Update kills stat box
        const killsBox = document.getElementById('detail-stat-kills');
        if (killsBox) {
            killsBox.innerHTML = `<strong>💀 Kills:</strong> ${t.kills || 0}`;
        }

        // Update priority button
        const prioBtn = document.getElementById('btn-toggle-priority');
        if (prioBtn) {
            const priorityNames = ['FIRST', 'STRONGEST', 'WEAKEST', 'CLOSEST'];
            const curName = priorityNames[t.priority || 0];
            if (prioBtn.textContent.trim() !== curName) {
                prioBtn.textContent = curName;
            }
        }
    }

    selectPlacedTower(tower) {
        this.selectedPlacedTower = tower;
        this.selectedTowerType = null;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
        this.updateDetailPanel();
    }

    updateDetailPanel() {
        const panel = document.getElementById('tower-detail-panel');
        if (!this.selectedPlacedTower) {
            panel.innerHTML = `
                <div class="empty-detail">
                    <p>💡 Select a tower on the grid to inspect stats, upgrade tiers, repair, or sell.</p>
                    <p class="hint">Hotkeys: [1-8] Build, [U] Upgrade, [R] Repair, [S] Sell, [T] Targeting, [Space] Wave</p>
                </div>
            `;
            return;
        }

        const t = this.selectedPlacedTower;
        const info = this.towerTypes[t.type];
        const upgradeCost = t.tier === 1 ? Math.floor(info.cost * 1.5) : (t.tier === 2 ? Math.floor(info.cost * 2.5) : 0);
        const missingHp = t.maxHp - t.hp;
        const repairCost = missingHp > 0 ? Math.max(10, Math.floor(info.cost * 0.35 * (missingHp / t.maxHp))) : 0;
        const refund = Math.floor(info.cost * 0.7 * Math.max(0.2, t.hp / t.maxHp));

        panel.innerHTML = `
            <div class="detail-header">
                <div>
                    <h3 class="detail-title">${info.name} <span class="tier-tag">Tier ${t.tier}</span></h3>
                    <p class="detail-type">${info.desc}</p>
                </div>
            </div>

            <div class="detail-hp-bar">
                <div class="hp-fill" style="width: ${(t.hp / t.maxHp) * 100}%"></div>
                <span class="hp-text">HP: ${Math.round(t.hp)} / ${Math.round(t.maxHp)}</span>
            </div>

            <div class="detail-stats-grid">
                <div class="stat-box"><strong>Range:</strong> ${t.range.toFixed(1)}</div>
                <div class="stat-box" id="detail-stat-status"><strong>Status:</strong> ${t.stunTimer > 0 ? '⚡ Stunned' : 'Active'}</div>
                <div class="stat-box" id="detail-stat-priority">
                    <strong>🎯 Target:</strong>
                    <button id="btn-toggle-priority" class="priority-toggle-btn" title="Click to cycle targeting priority [Hotkey: T]">
                        ${['FIRST', 'STRONGEST', 'WEAKEST', 'CLOSEST'][t.priority || 0]}
                    </button>
                </div>
                <div class="stat-box" id="detail-stat-kills"><strong>💀 Kills:</strong> ${t.kills || 0}</div>
                <div class="stat-box"><strong>Grid:</strong> (${t.gx}, ${t.gy})</div>
                <div class="stat-box" id="detail-stat-refund"><strong>Refund:</strong> 💰 ${refund}</div>
            </div>

            <div class="detail-actions">
                ${t.tier < 3 ? `
                    <button id="btn-upgrade-tower" class="action-btn upgrade-btn" ${this.game.state.gold < upgradeCost ? 'disabled' : ''}>
                        ⭐ Upgrade to Tier ${t.tier + 1} (💰 ${upgradeCost})
                    </button>
                ` : `
                    <button class="action-btn max-btn" disabled>★ MAX TIER REACHED</button>
                `}

                <button id="btn-repair-tower" class="action-btn repair-btn" ${missingHp <= 0 || this.game.state.gold < repairCost ? 'disabled' : ''}>
                    🔧 Repair (💰 ${repairCost})
                </button>

                <button id="btn-sell-tower" class="action-btn sell-btn">
                    💰 Sell (+${refund})
                </button>
            </div>
        `;

        const prioBtn = document.getElementById('btn-toggle-priority');
        if (prioBtn) {
            prioBtn.addEventListener('click', () => {
                const nextP = ((t.priority || 0) + 1) % 4;
                this.game.setTowerTargeting(t.id, nextP);
            });
        }

        const upBtn = document.getElementById('btn-upgrade-tower');
        if (upBtn) upBtn.addEventListener('click', () => this.game.upgradeTower(t.id));

        const repBtn = document.getElementById('btn-repair-tower');
        if (repBtn) repBtn.addEventListener('click', () => this.game.repairTower(t.id));

        const sellBtn = document.getElementById('btn-sell-tower');
        if (sellBtn) sellBtn.addEventListener('click', () => this.game.sellTower(t.id));
    }

    showSurgeWarning(tier) {
        const banner = document.getElementById('surge-warning-banner');
        const desc = document.getElementById('surge-banner-desc');
        if (!banner) return;
        const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][tier - 1] || tier;
        const threatPct = Math.round((Math.pow(1.75, tier) - 1) * 100);
        if (desc) {
            desc.textContent = `TITAN OVERDRIVE SURGE ${roman}: Hostile HP, attack power & speed exponentially increased by +${threatPct}%!`;
        }
        banner.classList.remove('hidden');
        setTimeout(() => banner.classList.add('visible'), 50);
        setTimeout(() => {
            banner.classList.remove('visible');
            setTimeout(() => banner.classList.add('hidden'), 500);
        }, 3800);
    }

    renderBestiary() {
        const container = document.getElementById('bestiary-content');
        container.innerHTML = `
            <h2>📖 Tactical Database & Sprite Showcase</h2>
            <div class="bestiary-tabs">
                <button class="tab-btn active" id="tab-towers">TOWERS & UPGRADES (24 Sprites)</button>
                <button class="tab-btn" id="tab-enemies">ENEMIES & BOSSES (13 Units)</button>
                <button class="tab-btn" id="tab-protocols">PROTOCOLS & CATACLYSMS</button>
            </div>
            <div id="bestiary-tab-content"></div>
        `;

        document.getElementById('tab-towers').addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            this.showBestiaryTowers();
        });

        document.getElementById('tab-enemies').addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            this.showBestiaryEnemies();
        });

        document.getElementById('tab-protocols').addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            this.showBestiaryProtocols();
        });

        this.showBestiaryTowers();
    }

    showBestiaryTowers() {
        const target = document.getElementById('bestiary-tab-content');
        target.innerHTML = '<div class="cards-grid"></div>';
        const grid = target.querySelector('.cards-grid');

        this.towerTypes.forEach((t) => {
            const card = document.createElement('div');
            card.className = 'database-card';

            let tiersHtml = '';
            for (let tier = 1; tier <= 3; tier++) {
                tiersHtml += `
                    <div class="tier-preview">
                        <canvas id="prev-t-${t.id}-${tier}" width="48" height="48"></canvas>
                        <span>Tier ${tier}</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <h4>${t.name} (Base Cost: 💰 ${t.cost})</h4>
                <p>${t.desc}</p>
                <div class="tier-row">${tiersHtml}</div>
            `;
            grid.appendChild(card);

            // Draw canvases
            setTimeout(() => {
                for (let tier = 1; tier <= 3; tier++) {
                    const canvas = document.getElementById(`prev-t-${t.id}-${tier}`);
                    if (!canvas) continue;
                    const ctx = canvas.getContext('2d');
                    const base = this.game.sprites.get(`tower_${t.id}_${tier}_base`);
                    const turret = this.game.sprites.get(`tower_${t.id}_${tier}_turret`);
                    ctx.clearRect(0, 0, 48, 48);
                    if (base) ctx.drawImage(base, 0, 0, 48, 48);
                    if (turret) ctx.drawImage(turret, 0, 0, 48, 48);
                }
            }, 50);
        });
    }

    showBestiaryEnemies() {
        const target = document.getElementById('bestiary-tab-content');
        const enemies = [
            { id: 0, name: 'Scout Drone', type: 'Walker', desc: 'Swift recon unit, moves fast along the open path.' },
            { id: 1, name: 'Armored Juggernaut', type: 'Walker', desc: 'Heavy armor plating, cuts incoming physical damage by 50%.' },
            { id: 2, name: 'Phantom Wraith', type: 'Walker', desc: 'Ethereal ghost creature, completely immune to frost slows.' },
            { id: 3, name: 'Healer Drone', type: 'Walker (Support)', desc: 'Radiates a green regeneration aura to nearby wounded allies.' },
            { id: 4, name: 'Swarm Beetle', type: 'Walker', desc: 'Fragile swarm unit deployed in dense fast-moving clusters.' },
            { id: 5, name: 'Siege Brawler', type: 'Tower Attacker', desc: 'Heavy melee striker that charges and pulverizes blocking towers!' },
            { id: 6, name: 'Artillery Bombardier', type: 'Tower Attacker', desc: 'Long-range mortar beetle that bombards towers from afar.' },
            { id: 7, name: 'Suicide Bomber', type: 'Tower Attacker', desc: 'Volatile explosive crawler that detonates on tower contact!' },
            { id: 8, name: 'EMP Disruptor', type: 'Tower Attacker', desc: 'Emits electromagnetic shockwaves that disable towers for 3.5s!' },
            { id: 9, name: 'Acid Spitter', type: 'Tower Attacker', desc: 'Launches caustic bile that corrodes tower armor and deals DoT.' },
            { id: 10, name: 'Titan Colossus (Boss 1)', type: 'Supreme Boss', desc: 'Quadruped war fortress that stomps the ground, damaging all nearby towers.' },
            { id: 11, name: 'Broodmother (Boss 2)', type: 'Supreme Boss', desc: 'Giant hive queen that continually hatches swarms of runner and siege minions.' },
            { id: 12, name: 'Annihilator Dreadnought (Boss 3)', type: 'Supreme Boss', desc: 'High-tech assault mech equipped with antimatter reactor and orbital missiles.' }
        ];

        target.innerHTML = '<div class="cards-grid"></div>';
        const grid = target.querySelector('.cards-grid');

        enemies.forEach((e) => {
            const card = document.createElement('div');
            card.className = 'database-card';
            card.innerHTML = `
                <div class="enemy-card-header">
                    <canvas id="prev-e-${e.id}" width="54" height="54"></canvas>
                    <div>
                        <h4>${e.name}</h4>
                        <span class="badge ${e.type.includes('Attacker') ? 'badge-attacker' : (e.type.includes('Boss') ? 'badge-boss' : 'badge-walker')}">${e.type}</span>
                    </div>
                </div>
                <p>${e.desc}</p>
            `;
            grid.appendChild(card);

            setTimeout(() => {
                const canvas = document.getElementById(`prev-e-${e.id}`);
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                const sprite = this.game.sprites.get(`enemy_${e.id}`);
                if (sprite) {
                    ctx.drawImage(sprite, 0, 0, 54, 54);
                }
            }, 50);
        });
    }

    showBestiaryProtocols() {
        const target = document.getElementById('bestiary-tab-content');
        target.innerHTML = `
            <div class="protocols-container">
                <div class="protocol-section">
                    <h3>🌊 Exponential Cataclysm Surges</h3>
                    <p>After the first <strong>Titan Colossus</strong> on <strong>Wave 5</strong>, hostiles undergo an exponential evolution every 4 waves (<strong>Waves 9, 13, 17, 21, 25...</strong>):</p>
                    <div class="protocol-grid">
                        <div class="protocol-item">
                            <strong>Wave 9 (Surge I)</strong>
                            <span>+175% Threat Multiplier. Titan Colossus returns leading a heavy siege vanguard.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>Wave 13 (Surge II)</strong>
                            <span>+306% Threat Multiplier. Dual-Boss Cataclysm: Titan Colossus AND Broodmother Queen!</span>
                        </div>
                        <div class="protocol-item">
                            <strong>Wave 17 (Surge III)</strong>
                            <span>+536% Threat Multiplier. Annihilator Dreadnought Mech AND Titan Colossus siege squad.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>Wave 21+ (Surge IV+)</strong>
                            <span>+938% Threat Multiplier. Triple Boss Apocalypse Trinity with escalating multi-boss deployments!</span>
                        </div>
                    </div>
                </div>

                <div class="protocol-section">
                    <h3>⚡ Commander Tactical Superweapons</h3>
                    <div class="protocol-grid">
                        <div class="protocol-item">
                            <strong>[Q] Orbital EMP Blast</strong>
                            <span>35s Cooldown. Discharges a map-wide electromagnetic pulse that stuns all hostiles for 3.5s and immediately clears EMP stuns from friendly towers.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>[E] Kinetic Orbital Strike</strong>
                            <span>45s Cooldown. Fires high-explosive kinetic orbital artillery onto cursor coordinates, inflicting 950 area damage with massive impact shockwaves.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>[F] Bastion Overdrive</strong>
                            <span>48s Cooldown. Emergency nanite surge: instantly repairs 35% max HP to all placed towers and grants 2x fire rate (+35% damage) for 8 seconds.</span>
                        </div>
                    </div>
                </div>

                <div class="protocol-section">
                    <h3>🧬 Hostile Elite Mutations & Affixes</h3>
                    <div class="protocol-grid">
                        <div class="protocol-item">
                            <strong>🛡️ Kinetic Shield Barrier</strong>
                            <span>Generates a protective cyan energy bubble absorbing up to 45% of maximum HP before hull damage occurs.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>⚡ Berserk Frenzy</strong>
                            <span>Enraged fiery aura providing +30% movement speed and 35% faster attack rate against blocking towers.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>💚 Regenerator Nanites</strong>
                            <span>Bio-nanite regenerative field constantly healing 3% of maximum HP per second.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>⛓️ Juggernaut Plating</strong>
                            <span>Reinforced heavy steel alloy granting 35% flat damage resistance against all non-laser physical weapons.</span>
                        </div>
                    </div>
                </div>

                <div class="protocol-section">
                    <h3>🎯 Dynamic Targeting Priorities</h3>
                    <div class="protocol-grid">
                        <div class="protocol-item">
                            <strong>FIRST</strong>
                            <span>Targets the hostile furthest along the path closest to the Core.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>STRONGEST</strong>
                            <span>Focuses highest current HP (essential for Snipers & Lasers melting Titans and Bosses!).</span>
                        </div>
                        <div class="protocol-item">
                            <strong>WEAKEST</strong>
                            <span>Prioritizes low-health runners to quickly clear incoming swarms.</span>
                        </div>
                        <div class="protocol-item">
                            <strong>CLOSEST</strong>
                            <span>Engages the nearest hostile to the tower.</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

window.UIController = UIController;
