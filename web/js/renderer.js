// High Performance Canvas 2D Renderer for Tower Defense
// Handles grid, dynamic maze path, procedural sprites, healthbars, projectiles & FX

class GameRenderer {
    constructor(canvas, sprites) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sprites = sprites;

        this.gridWidth = 24;
        this.gridHeight = 14;
        this.cellSize = 40;

        this.canvas.width = this.gridWidth * this.cellSize;
        this.canvas.height = this.gridHeight * this.cellSize;

        this.floatingTexts = [];
        this.explosions = [];
        this.shockwaves = [];
        this.pathDashOffset = 0;
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
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Arena Grid & Background
        this.drawBackground(ctx);

        // 2. Draw Dynamic Flow Path (Energy Flow)
        this.drawDynamicPath(ctx, gameState.path);

        // 3. Draw Spawn Portal and Goal Nexus
        this.drawPortals(ctx);

        // 4. Draw Placed Towers
        this.drawTowers(ctx, gameState.towers, selectedPlacedTower);

        // 5. Draw Range & Hover Preview
        this.drawHoverPreview(ctx, hoverTile, selectedTowerType, gameState);

        // 6. Draw Enemies (Walkers, Attackers, Bosses)
        this.drawEnemies(ctx, gameState.enemies);

        // 7. Draw Projectiles
        this.drawProjectiles(ctx, gameState.projectiles);

        // 8. Draw Visual Events (Laser beams, lightning, repair beams)
        this.drawVisualEvents(ctx, gameState.events);

        // 9. Update and Draw Explosions and Particles
        this.drawEffects(ctx, dt);

        // 10. Draw Floating Combat Text
        this.drawFloatingTexts(ctx, dt);
    }

    drawBackground(ctx) {
        // Sci-Fi metallic grid floor
        ctx.fillStyle = '#0b1120'; // Slate deep cyber background
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid lines
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
        ctx.lineWidth = 1;

        for (let x = 0; x <= this.gridWidth; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.cellSize, 0);
            ctx.lineTo(x * this.cellSize, this.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= this.gridHeight; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.cellSize);
            ctx.lineTo(this.canvas.width, y * this.cellSize);
            ctx.stroke();
        }

        // Circuit board micro-dots
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        for (let x = 1; x < this.gridWidth; x += 2) {
            for (let y = 1; y < this.gridHeight; y += 2) {
                ctx.fillRect(x * this.cellSize - 1, y * this.cellSize - 1, 2, 2);
            }
        }
    }

    drawDynamicPath(ctx, path) {
        if (!path || path.length < 2) return;

        this.pathDashOffset = (this.pathDashOffset - 0.7) % 24;

        // Path glow underlay
        ctx.save();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.18)'; // Emerald energy flow
        ctx.lineWidth = this.cellSize * 0.7;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x * this.cellSize + this.cellSize / 2, path[0].y * this.cellSize + this.cellSize / 2);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x * this.cellSize + this.cellSize / 2, path[i].y * this.cellSize + this.cellSize / 2);
        }
        ctx.stroke();

        // Animated neon flow line
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = this.pathDashOffset;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
    }

    drawPortals(ctx) {
        const half = this.cellSize / 2;

        // Spawn Portal (0, 7)
        const sx = 0 * this.cellSize + half;
        const sy = 7 * this.cellSize + half;
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#fee2e2';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SPAWN', sx, sy);
        ctx.restore();

        // Goal Nexus (23, 7)
        const gx = 23 * this.cellSize + half;
        const gy = 7 * this.cellSize + half;
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(gx, gy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CORE', gx, gy);
        ctx.restore();
    }

    drawTowers(ctx, towers, selectedPlacedTower) {
        for (const t of towers) {
            const px = t.gx * this.cellSize;
            const py = t.gy * this.cellSize;
            const cx = px + this.cellSize / 2;
            const cy = py + this.cellSize / 2;

            // Highlight selected tower with animated ring
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

            // Draw Base Sprite
            const baseSprite = this.sprites.get(`tower_${t.type}_${t.tier}_base`);
            if (baseSprite) {
                ctx.drawImage(baseSprite, cx - 24, cy - 24, 48, 48);
            }

            // Draw Rotating Turret Head
            const turretSprite = this.sprites.get(`tower_${t.type}_${t.tier}_turret`);
            if (turretSprite) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(t.rotation);
                ctx.drawImage(turretSprite, -24, -24, 48, 48);
                ctx.restore();
            }

            // Stunned indicator (from EMP)
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

            // Health bar if damaged
            if (t.hp < t.maxHp) {
                this.drawBar(ctx, px + 4, py + 2, this.cellSize - 8, 4, t.hp / t.maxHp, '#22c55e', '#ef4444');
            }

            // Tier star badge
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
        // Range preview circle
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, range * this.cellSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.15)';
        ctx.fill();

        // Tile box
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, this.cellSize, this.cellSize);

        // Preview ghost turret
        const baseSprite = this.sprites.get(`tower_${selectedTowerType}_1_base`);
        const turretSprite = this.sprites.get(`tower_${selectedTowerType}_1_turret`);
        ctx.globalAlpha = 0.6;
        if (baseSprite) ctx.drawImage(baseSprite, cx - 24, cy - 24, 48, 48);
        if (turretSprite) ctx.drawImage(turretSprite, cx - 24, cy - 24, 48, 48);
        ctx.globalAlpha = 1.0;

        // Path blocked warning badge
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

            // Draw Enemy Sprite
            const sprite = this.sprites.get(`enemy_${e.variant}`);
            if (sprite) {
                ctx.save();
                ctx.translate(ex, ey);
                ctx.rotate(e.rotation);
                ctx.drawImage(sprite, -half, -half, spriteSize, spriteSize);
                ctx.restore();
            }

            // Status effect aura (Slow / Burn)
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

            // Health bar
            const barWidth = isBoss ? 48 : 26;
            const barY = ey - half - (isBoss ? 8 : 5);
            this.drawBar(ctx, ex - barWidth / 2, barY, barWidth, isBoss ? 5 : 3, e.hp / e.maxHp, '#22c55e', '#ef4444');

            // Boss label
            if (isBoss) {
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                const bossName = e.variant === 10 ? 'TITAN' : (e.variant === 11 ? 'BROOD' : 'MECH');
                ctx.fillText(`★ ${bossName}`, ex, barY - 3);
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
                // Flamethrower fire particle
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
                // Laser beam or Sniper rail
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

                // Core white line
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = isRail ? 2 : 1;
                ctx.stroke();
                ctx.restore();
            } else if (ev.type === 2) {
                // Tesla chain lightning
                ctx.save();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5;
                ctx.shadowColor = '#60a5fa';
                ctx.shadowBlur = 8;
                // Jagged line
                const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 16;
                const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 16;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(midX, midY);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.restore();
            } else if (ev.type === 0) {
                // Trigger explosion animation
                this.addExplosion(ev.x, ev.y, ev.value);
            }
        }
    }

    drawEffects(ctx, dt) {
        // Explosions
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
