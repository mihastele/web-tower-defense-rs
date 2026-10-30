// High Performance Canvas 2D Renderer for Tower Defense with Pan & Zoom Camera
// Handles grid, dynamic maze path, procedural sprites, healthbars, projectiles & FX

class GameRenderer {
    constructor(canvas, sprites) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sprites = sprites;

        this.gridWidth = 24;
        this.gridHeight = 14;
        this.cellSize = 40;

        // Base world dimensions
        this.worldWidth = this.gridWidth * this.cellSize;   // 960
        this.worldHeight = this.gridHeight * this.cellSize; // 560

        // Canvas display sizing
        this.resize();

        // Virtual Camera for moving & zooming with thumb/touch/mouse
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1.0,
            minZoom: 0.45,
            maxZoom: 2.5
        };

        this.floatingTexts = [];
        this.explosions = [];
        this.shockwaves = [];
        this.pathDashOffset = 0;
        this.shakeDuration = 0;
        this.shakeMagnitude = 0;

        this.resetCamera();
    }

    screenShake(magnitude = 15, duration = 0.5) {
        this.shakeMagnitude = magnitude;
        this.shakeDuration = duration;
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = rect.width > 0 ? rect.width : this.worldWidth;
        const h = rect.height > 0 ? rect.height : this.worldHeight;

        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.displayWidth = w;
        this.displayHeight = h;
    }

    resetCamera() {
        // Fit world centered within canvas display
        const scaleX = (this.canvas.width / (window.devicePixelRatio || 1)) / this.worldWidth;
        const scaleY = (this.canvas.height / (window.devicePixelRatio || 1)) / this.worldHeight;
        const fitZoom = Math.max(0.5, Math.min(scaleX, scaleY, 1.15));

        this.camera.zoom = fitZoom;
        const dw = this.canvas.width / (window.devicePixelRatio || 1);
        const dh = this.canvas.height / (window.devicePixelRatio || 1);
        this.camera.x = Math.round((dw - this.worldWidth * fitZoom) / 2);
        this.camera.y = Math.round((dh - this.worldHeight * fitZoom) / 2);
    }

    zoomAt(factor, screenX, screenY) {
        const oldZoom = this.camera.zoom;
        const newZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, oldZoom * factor));
        if (Math.abs(newZoom - oldZoom) < 0.001) return;

        this.camera.x = screenX - (screenX - this.camera.x) * (newZoom / oldZoom);
        this.camera.y = screenY - (screenY - this.camera.y) * (newZoom / oldZoom);
        this.camera.zoom = newZoom;
    }

    screenToWorld(screenX, screenY) {
        const wx = (screenX - this.camera.x) / this.camera.zoom;
        const wy = (screenY - this.camera.y) / this.camera.zoom;
        return {
            worldX: wx,
            worldY: wy,
            gx: Math.floor(wx / this.cellSize),
            gy: Math.floor(wy / this.cellSize)
        };
    }

    addFloatingText(x, y, text, color = '#facc15') {
        this.floatingTexts.push({
            x: x * this.cellSize,
            y: y * this.cellSize,
            text,
            color,
            alpha: 1.0,
            vy: -1.2,
            life: 1.0
        });
    }

    addExplosion(x, y, radius = 1.0) {
        this.explosions.push({
            x: x * this.cellSize,
            y: y * this.cellSize,
            radius: radius * this.cellSize,
            currentRadius: 4,
            alpha: 1.0,
            color: '#f97316'
        });
    }

    render(gameState, hoverTile, selectedTowerType, selectedPlacedTower, dt) {
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio || 1;

        // Clear entire canvas
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply DPR scaling
        ctx.scale(dpr, dpr);

        // Apply Camera Transformation (Pan & Zoom & Screen Shake)
        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
            const sx = (Math.random() - 0.5) * this.shakeMagnitude;
            const sy = (Math.random() - 0.5) * this.shakeMagnitude;
            ctx.translate(this.camera.x + sx, this.camera.y + sy);
        } else {
            ctx.translate(this.camera.x, this.camera.y);
        }
        ctx.scale(this.camera.zoom, this.camera.zoom);

        // 1. Draw Arena Grid & Background
        this.drawBackground(ctx);

        // 2. Draw Terrain Obstacles for current level
        this.drawObstacles(ctx, gameState.obstacles);

        // 3. Draw Dynamic Flow Path (Energy Flow)
        this.drawDynamicPath(ctx, gameState.path);

        // 4. Draw Spawn Portal and Goal Nexus (Dynamic for each level!)
        this.drawPortals(ctx, gameState.spawn, gameState.goal);

        // 5. Draw Placed Towers
        const isOverdrive = gameState.abilities && gameState.abilities.overdriveActive;
        this.drawTowers(ctx, gameState.towers, selectedPlacedTower, isOverdrive);

        // 6. Draw Range & Hover Preview
        this.drawHoverPreview(ctx, hoverTile, selectedTowerType, gameState);

        // 7. Draw Enemies (Walkers, Attackers, Bosses)
        this.drawEnemies(ctx, gameState.enemies);

        // 8. Draw Projectiles
        this.drawProjectiles(ctx, gameState.projectiles);

        // 9. Draw Visual Events (Laser beams, lightning, repair beams)
        this.drawVisualEvents(ctx, gameState.events);

        // 10. Update and Draw Explosions and Particles
        this.drawEffects(ctx, dt);

        // 11. Draw Floating Combat Text
        this.drawFloatingTexts(ctx, dt);

        ctx.restore();
    }

    drawBackground(ctx) {
        // Deep space metallic grid floor
        ctx.fillStyle = '#070c18';
        ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

        // Grid lines
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
        ctx.lineWidth = 1;

        for (let x = 0; x <= this.gridWidth; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.cellSize, 0);
            ctx.lineTo(x * this.cellSize, this.worldHeight);
            ctx.stroke();
        }
        for (let y = 0; y <= this.gridHeight; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.cellSize);
            ctx.lineTo(this.worldWidth, y * this.cellSize);
            ctx.stroke();
        }

        // Circuit board tech dots
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        for (let x = 1; x < this.gridWidth; x += 2) {
            for (let y = 1; y < this.gridHeight; y += 2) {
                ctx.fillRect(x * this.cellSize - 1.5, y * this.cellSize - 1.5, 3, 3);
            }
        }

        // Outer boundary border
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);
    }

    drawObstacles(ctx, obstacles) {
        if (!obstacles) return;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const idx = y * this.gridWidth + x;
                if (obstacles[idx] > 0.5) {
                    const px = x * this.cellSize;
                    const py = y * this.cellSize;

                    ctx.save();
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4);

                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(px + 5, py + 5, this.cellSize - 10, this.cellSize - 10);

                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4);

                    ctx.fillStyle = '#f59e0b';
                    ctx.fillRect(px + this.cellSize / 2 - 2, py + this.cellSize / 2 - 2, 4, 4);
                    ctx.restore();
                }
            }
        }
    }

    drawDynamicPath(ctx, path) {
        if (!path || path.length < 2) return;

        this.pathDashOffset = (this.pathDashOffset - 0.7) % 24;

        ctx.save();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.lineWidth = this.cellSize * 0.7;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x * this.cellSize + this.cellSize / 2, path[0].y * this.cellSize + this.cellSize / 2);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x * this.cellSize + this.cellSize / 2, path[i].y * this.cellSize + this.cellSize / 2);
        }
        ctx.stroke();

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = this.pathDashOffset;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
    }

    drawPortals(ctx, spawn, goal) {
        const half = this.cellSize / 2;
        const sx = (spawn ? spawn.x : 0) * this.cellSize + half;
        const sy = (spawn ? spawn.y : 7) * this.cellSize + half;

        // Spawn Portal
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#fee2e2';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SPAWN', sx, sy);
        ctx.restore();

        // Goal Nexus
        const gx = (goal ? goal.x : 23) * this.cellSize + half;
        const gy = (goal ? goal.y : 7) * this.cellSize + half;
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.arc(gx, gy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CORE', gx, gy);
        ctx.restore();
    }

    drawTowers(ctx, towers, selectedPlacedTower, isOverdrive = false) {
        for (const t of towers) {
            const px = t.gx * this.cellSize;
            const py = t.gy * this.cellSize;
            const cx = px + this.cellSize / 2;
            const cy = py + this.cellSize / 2;

            if (selectedPlacedTower && selectedPlacedTower.id === t.id) {
                ctx.save();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, t.range * this.cellSize, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
                ctx.fill();

                ctx.strokeStyle = '#fbbf24';
                ctx.strokeRect(px - 2, py - 2, this.cellSize + 4, this.cellSize + 4);
                ctx.restore();
            }

            // Overdrive electric aura
            if (isOverdrive) {
                ctx.save();
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#f59e0b';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(cx, cy, 21 + Math.sin(Date.now() * 0.012) * 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            const baseSprite = this.sprites.get(`tower_${t.type}_${t.tier}_base`);
            if (baseSprite) {
                ctx.drawImage(baseSprite, cx - 24, cy - 24, 48, 48);
            }

            const turretSprite = this.sprites.get(`tower_${t.type}_${t.tier}_turret`);
            if (turretSprite) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(t.rotation);
                ctx.drawImage(turretSprite, -24, -24, 48, 48);
                ctx.restore();
            }

            if (t.stunTimer > 0) {
                ctx.save();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, 14, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = '#67e8f9';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('⚡STUN', cx, py - 4);
                ctx.restore();
            }

            if (t.hp < t.maxHp) {
                this.drawBar(ctx, px + 4, py + 2, this.cellSize - 8, 4, t.hp / t.maxHp, '#22c55e', '#ef4444');
            }

            if (t.tier > 1) {
                ctx.fillStyle = t.tier === 3 ? '#c084fc' : '#fbbf24';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(t.tier === 3 ? '★III' : '★II', px + this.cellSize - 2, py + this.cellSize - 2);
            }
        }
    }

    drawHoverPreview(ctx, hoverTile, selectedTowerType, gameState) {
        if (!hoverTile || selectedTowerType === null) return;

        const hx = hoverTile.x;
        const hy = hoverTile.y;
        const px = hx * this.cellSize;
        const py = hy * this.cellSize;
        const cx = px + this.cellSize / 2;
        const cy = py + this.cellSize / 2;

        const isValid = hoverTile.isValid;
        const color = isValid ? '#22c55e' : '#ef4444';
        const range = hoverTile.range || 3.2;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, range * this.cellSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.15)';
        ctx.fill();

        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, this.cellSize, this.cellSize);

        const baseSprite = this.sprites.get(`tower_${selectedTowerType}_1_base`);
        const turretSprite = this.sprites.get(`tower_${selectedTowerType}_1_turret`);
        ctx.globalAlpha = 0.6;
        if (baseSprite) ctx.drawImage(baseSprite, cx - 24, cy - 24, 48, 48);
        if (turretSprite) ctx.drawImage(turretSprite, cx - 24, cy - 24, 48, 48);
        ctx.globalAlpha = 1.0;

        if (!isValid) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.fillText('⛔ BLOCKED', cx, py - 6);
        }
        ctx.restore();
    }

    drawEnemies(ctx, enemies) {
        for (const e of enemies) {
            const ex = e.x * this.cellSize;
            const ey = e.y * this.cellSize;
            const isBoss = e.variant >= 10;
            const spriteSize = isBoss ? 64 : 40;
            const half = spriteSize / 2;

            // Elite Affix Auras
            if (e.eliteAffix === 1) {
                // Shielded: pulsing cyan energy bubble
                ctx.save();
                ctx.strokeStyle = '#22d3ee';
                ctx.lineWidth = 2.5;
                ctx.shadowColor = '#06b6d4';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(ex, ey, half + 4 + Math.sin(Date.now() * 0.008) * 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
                ctx.fill();
                ctx.restore();
            } else if (e.eliteAffix === 2) {
                // Berserk: fiery rage aura
                ctx.save();
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#f97316';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(ex, ey, half + 3 + Math.sin(Date.now() * 0.02) * 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                ctx.fill();
                ctx.restore();
            } else if (e.eliteAffix === 3) {
                // Regenerator: bio-green aura
                ctx.save();
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#34d399';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(ex, ey, half + 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            } else if (e.eliteAffix === 4) {
                // Juggernaut: heavy iron armor plating ring
                ctx.save();
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.arc(ex, ey, half + 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            const sprite = this.sprites.get(`enemy_${e.variant}`);
            if (sprite) {
                ctx.save();
                ctx.translate(ex, ey);
                ctx.rotate(e.rotation);
                ctx.drawImage(sprite, -half, -half, spriteSize, spriteSize);
                ctx.restore();
            }

            if (e.slowFactor < 1.0) {
                ctx.save();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(ex, ey, half * 0.8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            if (e.burnTimer > 0) {
                ctx.save();
                ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
                ctx.beginPath();
                ctx.arc(ex, ey, half * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            const barWidth = isBoss ? 48 : 28;
            const barY = ey - half - (isBoss ? 10 : 6);

            // Shield Bar (if shielded)
            if (e.maxShieldHp > 0 && e.shieldHp > 0) {
                this.drawBar(ctx, ex - barWidth / 2, barY - 4, barWidth, 3, e.shieldHp / e.maxShieldHp, '#06b6d4', '#0f766e');
            }

            // Health Bar
            this.drawBar(ctx, ex - barWidth / 2, barY, barWidth, isBoss ? 5 : 3, e.hp / e.maxHp, '#22c55e', '#ef4444');

            // Unit Name / Affix Label
            if (isBoss || e.eliteAffix > 0) {
                ctx.save();
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                let label = '';
                if (isBoss) {
                    const bossName = e.variant === 10 ? 'TITAN' : (e.variant === 11 ? 'BROOD' : 'MECH');
                    label = `★ ${bossName}`;
                    ctx.fillStyle = '#ef4444';
                }
                if (e.eliteAffix > 0) {
                    const affixNames = ['', '🛡️SHIELD', '⚡BERSERK', '💚REGEN', '⛓️ARMOR'];
                    label = label ? `${label} ${affixNames[e.eliteAffix]}` : affixNames[e.eliteAffix];
                    if (!isBoss) ctx.fillStyle = '#f59e0b';
                }
                ctx.fillText(label, ex, barY - (e.maxShieldHp > 0 && e.shieldHp > 0 ? 6 : 3));
                ctx.restore();
            }
        }
    }

    drawProjectiles(ctx, projectiles) {
        for (const p of projectiles) {
            const px = p.x * this.cellSize;
            const py = p.y * this.cellSize;

            let spriteKey = 'proj_bullet';
            if (p.type === 1) spriteKey = 'proj_cannon';
            else if (p.type === 2) spriteKey = 'proj_ice';
            else if (p.type === 4) {
                ctx.fillStyle = 'rgba(249, 115, 22, 0.7)';
                ctx.beginPath();
                ctx.arc(px, py, 6, 0, Math.PI * 2);
                ctx.fill();
                continue;
            } else if (p.type === 7) spriteKey = 'proj_mortar';
            else if (p.type === 8) spriteKey = 'proj_acid';

            const sprite = this.sprites.get(spriteKey);
            if (sprite) {
                ctx.drawImage(sprite, px - 6, py - 6, 12, 12);
            }
        }
    }

    drawVisualEvents(ctx, events) {
        if (!events) return;
        for (const ev of events) {
            const x1 = ev.x * this.cellSize;
            const y1 = ev.y * this.cellSize;
            const x2 = ev.targetX * this.cellSize;
            const y2 = ev.targetY * this.cellSize;

            if (ev.type === 1) {
                ctx.save();
                const isRail = ev.value >= 4.0;
                ctx.strokeStyle = isRail ? '#c084fc' : '#ef4444';
                ctx.lineWidth = isRail ? 4 : 2.5;
                ctx.shadowColor = isRail ? '#a855f7' : '#f87171';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = isRail ? 2 : 1;
                ctx.stroke();
                ctx.restore();
            } else if (ev.type === 2) {
                ctx.save();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5;
                ctx.shadowColor = '#60a5fa';
                ctx.shadowBlur = 8;
                const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 16;
                const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 16;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(midX, midY);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.restore();
            } else if (ev.type === 0) {
                this.addExplosion(ev.x, ev.y, ev.value);
            } else if (ev.type === 3) {
                this.addExplosion(ev.x, ev.y, ev.value);
            }
        }
    }

    drawEffects(ctx, dt) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const ex = this.explosions[i];
            ex.currentRadius += (ex.radius - ex.currentRadius) * 12 * dt + 2;
            ex.alpha -= 2.5 * dt;

            if (ex.alpha <= 0) {
                this.explosions.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.fillStyle = `rgba(249, 115, 22, ${ex.alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, ex.currentRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(254, 240, 138, ${ex.alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    }

    drawFloatingTexts(ctx, dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy;
            ft.life -= dt;
            ft.alpha = Math.max(0, ft.life);

            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.fillStyle = ft.color;
            ctx.globalAlpha = ft.alpha;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }

    drawBar(ctx, x, y, width, height, pct, fgColor, bgColor) {
        const clamp = Math.max(0, Math.min(1, pct));
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = fgColor;
        ctx.fillRect(x, y, width * clamp, height);
    }
}

window.GameRenderer = GameRenderer;
