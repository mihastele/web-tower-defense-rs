// Procedural Pixel Art Sprite Generator for Towers, Enemies, Upgrades, and Bosses
// Generates crisp, retro-futuristic pixel-perfect spritesheets into memory canvases

class SpriteGenerator {
    constructor() {
        this.cache = new Map();
        this.pixelScale = 2; // For crisp pixel art rendering
    }

    // Helper to create an offscreen canvas
    createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        return { canvas, ctx };
    }

    // Initialize and generate all game sprites
    init() {
        console.log("Generating procedural pixel-art sprites...");

        // 1. Generate Towers (8 types x 3 tiers = 24 tower base and turret sprites)
        for (let type = 0; type < 8; type++) {
            for (let tier = 1; tier <= 3; tier++) {
                this.generateTowerSprite(type, tier);
            }
        }

        // 2. Generate Enemies (5 Walkers, 5 Attackers, 3 Bosses)
        for (let variant = 0; variant <= 12; variant++) {
            this.generateEnemySprite(variant);
        }

        // 3. Generate Projectiles and Effects
        this.generateProjectileSprites();

        console.log("Sprite generation complete! Cached sprites:", this.cache.size);
    }

    // Generate tower sprite: separated into Base and Turret so turret can rotate freely!
    generateTowerSprite(type, tier) {
        const size = 48;
        const half = size / 2;

        // Base canvas
        const base = this.createCanvas(size, size);
        const bctx = base.ctx;

        // Turret canvas
        const turret = this.createCanvas(size, size);
        const tctx = turret.ctx;

        // --- DRAW BASE ---
        // Hexagonal / circular metallic platform with bolts and tier-based glowing circuits
        const tierColors = {
            1: { metal: '#334155', border: '#1e293b', accent: '#64748b', glow: '#38bdf8' },
            2: { metal: '#1e293b', border: '#0f172a', accent: '#f59e0b', glow: '#fbbf24' },
            3: { metal: '#0f172a', border: '#020617', accent: '#a855f7', glow: '#c084fc' }
        };
        const colors = tierColors[tier];

        // Outer rim
        bctx.fillStyle = colors.border;
        bctx.beginPath();
        bctx.arc(half, half, 18, 0, Math.PI * 2);
        bctx.fill();

        // Inner platform
        bctx.fillStyle = colors.metal;
        bctx.beginPath();
        bctx.arc(half, half, 16, 0, Math.PI * 2);
        bctx.fill();

        // Metallic bevel highlights
        bctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        bctx.beginPath();
        bctx.arc(half, half - 2, 14, Math.PI, 0);
        bctx.fill();

        // Corner bolts
        bctx.fillStyle = colors.accent;
        const boltDist = 13;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
            bctx.fillRect(half + Math.cos(a) * boltDist - 1.5, half + Math.sin(a) * boltDist - 1.5, 3, 3);
        }

        // Tier energy conduits
        if (tier >= 2) {
            bctx.strokeStyle = colors.glow;
            bctx.lineWidth = 1.5;
            bctx.beginPath();
            bctx.arc(half, half, 11, 0, Math.PI * 2);
            bctx.stroke();
        }
        if (tier === 3) {
            // Power runes / corner spikes on tier 3
            bctx.fillStyle = colors.glow;
            for (let a = Math.PI / 4; a < Math.PI * 2; a += Math.PI / 2) {
                bctx.fillRect(half + Math.cos(a) * 15 - 2, half + Math.sin(a) * 15 - 2, 4, 4);
            }
        }

        // --- DRAW TURRET HEAD & BARRELS (pointing right at 0 radians) ---
        tctx.save();
        tctx.translate(half, half);

        switch (type) {
            case 0: // Gatling Gun
                if (tier === 1) {
                    // Single barrel
                    tctx.fillStyle = '#475569';
                    tctx.fillRect(0, -3, 16, 6);
                    tctx.fillStyle = '#1e293b';
                    tctx.fillRect(14, -4, 4, 8); // Muzzle brake
                } else if (tier === 2) {
                    // Twin barrels
                    tctx.fillStyle = '#334155';
                    tctx.fillRect(0, -6, 17, 4);
                    tctx.fillRect(0, 2, 17, 4);
                    tctx.fillStyle = '#f59e0b';
                    tctx.fillRect(15, -7, 4, 5);
                    tctx.fillRect(15, 2, 4, 5);
                } else {
                    // Quad rotary vulcan
                    tctx.fillStyle = '#0f172a';
                    tctx.fillRect(0, -8, 19, 3);
                    tctx.fillRect(0, -3, 20, 3);
                    tctx.fillRect(0, 2, 20, 3);
                    tctx.fillRect(0, 7, 19, 3);
                    // Glowing heat shroud
                    tctx.fillStyle = '#c084fc';
                    tctx.fillRect(4, -9, 8, 18);
                }
                // Central turret dome
                tctx.fillStyle = '#64748b';
                tctx.beginPath();
                tctx.arc(0, 0, 9 + tier, 0, Math.PI * 2);
                tctx.fill();
                tctx.fillStyle = colors.glow;
                tctx.beginPath();
                tctx.arc(0, 0, 4, 0, Math.PI * 2);
                tctx.fill();
                break;

            case 1: // Cannon / Heavy Mortar
                // Heavy cylindrical cannon barrel
                const barrelW = 8 + tier * 2;
                const barrelL = 14 + tier * 3;
                tctx.fillStyle = '#1e293b';
                tctx.fillRect(0, -barrelW / 2, barrelL, barrelW);
                tctx.fillStyle = '#475569';
                tctx.fillRect(barrelL - 4, -barrelW / 2 - 1, 5, barrelW + 2); // Heavy ring
                if (tier >= 2) {
                    // Hydraulic recoil pistons
                    tctx.fillStyle = colors.accent;
                    tctx.fillRect(2, -barrelW / 2 - 3, 10, 2);
                    tctx.fillRect(2, barrelW / 2 + 1, 10, 2);
                }
                // Massive breach block
                tctx.fillStyle = '#334155';
                tctx.fillRect(-8, -9, 12, 18);
                tctx.fillStyle = colors.glow;
                tctx.fillRect(-2, -4, 4, 8);
                break;

            case 2: // Cryo / Frost Spire
                // Hexagonal crystalline ice core with orbiting shards
                tctx.fillStyle = '#0284c7';
                tctx.beginPath();
                tctx.arc(0, 0, 10 + tier, 0, Math.PI * 2);
                tctx.fill();

                // Crystal diamond spire
                tctx.fillStyle = '#38bdf8';
                tctx.beginPath();
                tctx.moveTo(14 + tier * 3, 0);
                tctx.lineTo(2, 6 + tier);
                tctx.lineTo(-10, 0);
                tctx.lineTo(2, -6 - tier);
                tctx.closePath();
                tctx.fill();

                // Bright core
                tctx.fillStyle = '#e0f2fe';
                tctx.beginPath();
                tctx.arc(2, 0, 4, 0, Math.PI * 2);
                tctx.fill();

                // Floating ice shards
                tctx.fillStyle = '#bae6fd';
                tctx.fillRect(10, -11, 4, 4);
                tctx.fillRect(10, 7, 4, 4);
                if (tier === 3) {
                    tctx.fillRect(-10, -10, 5, 5);
                    tctx.fillRect(-10, 6, 5, 5);
                }
                break;

            case 3: // Tesla Coil
                // Copper coil rings
                tctx.fillStyle = '#b45309';
                for (let i = 0; i < 3 + tier; i++) {
                    tctx.fillRect(-8 + i * 4, -7, 2.5, 14);
                }
                // Insulator rods
                tctx.fillStyle = '#78350f';
                tctx.fillRect(-9, -2, 18, 4);
                // Glowing plasma sphere emitter
                tctx.fillStyle = '#38bdf8';
                tctx.beginPath();
                tctx.arc(8 + tier * 2, 0, 6 + tier, 0, Math.PI * 2);
                tctx.fill();
                tctx.fillStyle = '#ffffff';
                tctx.beginPath();
                tctx.arc(8 + tier * 2, 0, 3, 0, Math.PI * 2);
                tctx.fill();
                break;

            case 4: // Flamethrower
                // Twin fuel tanks on back
                tctx.fillStyle = '#b91c1c';
                tctx.fillRect(-10, -8, 8, 6);
                tctx.fillRect(-10, 2, 8, 6);
                tctx.fillStyle = '#ea580c';
                tctx.fillRect(-9, -7, 6, 4);
                tctx.fillRect(-9, 3, 6, 4);
                // Projector nozzle
                tctx.fillStyle = '#451a03';
                tctx.fillRect(-2, -5, 16 + tier * 2, 10);
                // Heat shroud & pilot torch
                tctx.fillStyle = '#f97316';
                tctx.fillRect(12 + tier * 2, -3, 4, 6);
                tctx.fillStyle = '#fef08a';
                tctx.fillRect(15 + tier * 2, -1, 3, 2);
                break;

            case 5: // Sniper / Railgun
                // Extreme long thin barrel with magnetic accelerators
                const railLen = 20 + tier * 4;
                tctx.fillStyle = '#1e293b';
                tctx.fillRect(0, -3, railLen, 6);
                // Magnetic accelerator coils
                tctx.fillStyle = colors.glow;
                tctx.fillRect(6, -4, 3, 8);
                tctx.fillRect(13, -4, 3, 8);
                if (tier >= 2) tctx.fillRect(20, -4, 3, 8);
                // Targeting scope with laser diode
                tctx.fillStyle = '#ef4444';
                tctx.fillRect(4, -8, 7, 3);
                // Heavy receiver
                tctx.fillStyle = '#334155';
                tctx.fillRect(-9, -6, 12, 12);
                break;

            case 6: // Laser Beam
                // Prismatic lens housing
                tctx.fillStyle = '#334155';
                tctx.fillRect(-6, -7, 14, 14);
                // Focusing cones
                tctx.fillStyle = '#64748b';
                tctx.beginPath();
                tctx.moveTo(8, -8);
                tctx.lineTo(16 + tier * 2, -3);
                tctx.lineTo(16 + tier * 2, 3);
                tctx.lineTo(8, 8);
                tctx.closePath();
                tctx.fill();
                // Glowing Ruby / Tachyon Lens
                tctx.fillStyle = tier === 3 ? '#ec4899' : '#ef4444';
                tctx.beginPath();
                tctx.arc(15 + tier * 2, 0, 3 + tier, 0, Math.PI * 2);
                tctx.fill();
                tctx.fillStyle = '#ffffff';
                tctx.fillRect(14 + tier * 2, -1, 3, 2);
                break;

            case 7: // Aegis Support Beacon
                // Hexagonal generator core with pulsating cross/shield
                tctx.fillStyle = '#065f46';
                tctx.beginPath();
                tctx.arc(0, 0, 10 + tier, 0, Math.PI * 2);
                tctx.fill();
                tctx.fillStyle = '#10b981';
                tctx.beginPath();
                tctx.arc(0, 0, 7 + tier, 0, Math.PI * 2);
                tctx.fill();
                // Glowing nanite medical cross
                tctx.fillStyle = '#ecfdf5';
                tctx.fillRect(-5, -2, 10, 4);
                tctx.fillRect(-2, -5, 4, 10);
                // Orbiting repair satellite antennae
                tctx.fillStyle = '#34d399';
                tctx.fillRect(8, -10, 3, 3);
                tctx.fillRect(-10, 8, 3, 3);
                if (tier === 3) {
                    tctx.fillRect(-10, -10, 3, 3);
                    tctx.fillRect(8, 8, 3, 3);
                }
                break;
        }

        tctx.restore();

        this.cache.set(`tower_${type}_${tier}_base`, base.canvas);
        this.cache.set(`tower_${type}_${tier}_turret`, turret.canvas);
    }

    // Generate enemy sprites: Walkers (0-4), Attackers (5-9), Bosses (10-12)
    generateEnemySprite(variant) {
        const isBoss = variant >= 10;
        const size = isBoss ? 64 : 40;
        const half = size / 2;

        const { canvas, ctx } = this.createCanvas(size, size);
        ctx.save();
        ctx.translate(half, half);

        switch (variant) {
            // === WALKERS ===
            case 0: // Scout: sleek cyber raptor / runner
                ctx.fillStyle = '#22c55e'; // Green runner
                ctx.beginPath();
                ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                // Head
                ctx.fillStyle = '#16a34a';
                ctx.beginPath();
                ctx.arc(8, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                // Glowing visor
                ctx.fillStyle = '#facc15';
                ctx.fillRect(9, -2, 3, 4);
                // Swift legs
                ctx.strokeStyle = '#15803d';
                ctx.lineWidth = 2;
                ctx.strokeRect(-8, -10, 4, 20);
                break;

            case 1: // Armored: heavy iron plated juggernaut
                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.fill();
                // Heavy plasteel plates
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(-10, -10, 20, 20);
                // Armor spikes
                ctx.fillStyle = '#f97316';
                ctx.fillRect(-12, -12, 4, 4);
                ctx.fillRect(8, -12, 4, 4);
                ctx.fillRect(-12, 8, 4, 4);
                ctx.fillRect(8, 8, 4, 4);
                // Heavy eye slot
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(4, -2, 6, 4);
                break;

            case 2: // Phantom: ethereal phase walker
                ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.fill();
                // Inner spectral core
                ctx.fillStyle = '#c084fc';
                ctx.beginPath();
                ctx.arc(2, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                // Shifting tendrils
                ctx.fillStyle = '#f3e8ff';
                ctx.fillRect(-10, -5, 4, 10);
                ctx.fillRect(-6, -8, 3, 16);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(5, -2, 3, 4);
                break;

            case 3: // Healer Drone: hovering med-bot
                ctx.fillStyle = '#06b6d4';
                ctx.beginPath();
                ctx.arc(0, 0, 11, 0, Math.PI * 2);
                ctx.fill();
                // White outer shield
                ctx.strokeStyle = '#cffafe';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 13, 0, Math.PI * 2);
                ctx.stroke();
                // Medical green cross
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(-6, -2, 12, 4);
                ctx.fillRect(-2, -6, 4, 12);
                break;

            case 4: // Swarm Bug: small, red skittering beetle
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                // Yellow eyes
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(5, -3, 2, 2);
                ctx.fillRect(5, 1, 2, 2);
                // Insect mandibles
                ctx.strokeStyle = '#7f1d1d';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-6, -8, 12, 16);
                break;

            // === TOWER ATTACKERS (Breakers & Siege) ===
            case 5: // Siege Brawler: gorilla fists & battering rams
                ctx.fillStyle = '#78350f'; // Dark bronze
                ctx.beginPath();
                ctx.arc(0, 0, 13, 0, Math.PI * 2);
                ctx.fill();
                // Massive battering ram fists
                ctx.fillStyle = '#b45309';
                ctx.fillRect(6, -11, 8, 6);
                ctx.fillRect(6, 5, 8, 6);
                ctx.fillStyle = '#f59e0b'; // Spiked knuckles
                ctx.fillRect(12, -10, 3, 4);
                ctx.fillRect(12, 6, 3, 4);
                // Aggressive red eyes
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(4, -3, 4, 2);
                ctx.fillRect(4, 1, 4, 2);
                break;

            case 6: // Artillery Bug: bombardier beetle with mortar shell back
                ctx.fillStyle = '#431407';
                ctx.beginPath();
                ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
                ctx.fill();
                // Massive mortar barrel tube on back
                ctx.fillStyle = '#ea580c';
                ctx.fillRect(-8, -4, 14, 8);
                ctx.fillStyle = '#7c2d12';
                ctx.fillRect(4, -5, 4, 10);
                // Glowing volatile ammo sac
                ctx.fillStyle = '#facc15';
                ctx.beginPath();
                ctx.arc(-8, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 7: // Bomber: suicide spherical rolling bomb with fuse
                ctx.fillStyle = '#171717';
                ctx.beginPath();
                ctx.arc(0, 0, 11, 0, Math.PI * 2);
                ctx.fill();
                // Pulsing volatile core
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fef08a';
                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                // Hazard stripes
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 2;
                ctx.strokeRect(-9, -9, 18, 18);
                break;

            case 8: // EMP Disruptor: electromagnetic shockwave disc
                ctx.fillStyle = '#1e1b4b';
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.fill();
                // Rotating Tesla ring
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.stroke();
                // Central EMP capacitor
                ctx.fillStyle = '#67e8f9';
                ctx.fillRect(-4, -4, 8, 8);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-2, -2, 4, 4);
                break;

            case 9: // Acid Spitter: toxic snake/hydra beast
                ctx.fillStyle = '#14532d';
                ctx.beginPath();
                ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                // Venom sack
                ctx.fillStyle = '#84cc16';
                ctx.beginPath();
                ctx.arc(-4, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                // Maw dripping acid
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(6, -3, 6, 6);
                ctx.fillStyle = '#a3e635';
                ctx.fillRect(10, 0, 3, 5);
                break;

            // === BOSSES ===
            case 10: // Titan Colossus (Boss 1): Quadruped walking fortress
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(-18, -18, 36, 36);
                // Thick iron armor plating
                ctx.fillStyle = '#334155';
                ctx.fillRect(-14, -14, 28, 28);
                // Molten lava core vents
                ctx.fillStyle = '#f97316';
                ctx.fillRect(-8, -8, 16, 16);
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(-4, -4, 8, 8);
                // Heavy seismic tread feet
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-22, -22, 10, 10);
                ctx.fillRect(12, -22, 10, 10);
                ctx.fillRect(-22, 12, 10, 10);
                ctx.fillRect(12, 12, 10, 10);
                // Boss health indicator crown
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(14, -4, 6, 8);
                break;

            case 11: // Broodmother (Boss 2): Giant hive queen with egg sacs
                ctx.fillStyle = '#581c87';
                ctx.beginPath();
                ctx.ellipse(0, 0, 22, 16, 0, 0, Math.PI * 2);
                ctx.fill();
                // Pulsating brood sac
                ctx.fillStyle = '#9333ea';
                ctx.beginPath();
                ctx.arc(-10, 0, 12, 0, Math.PI * 2);
                ctx.fill();
                // Glowing alien eggs
                ctx.fillStyle = '#4ade80';
                ctx.beginPath();
                ctx.arc(-12, -4, 4, 0, Math.PI * 2);
                ctx.arc(-8, 3, 4, 0, Math.PI * 2);
                ctx.arc(-14, 4, 3, 0, Math.PI * 2);
                ctx.fill();
                // Razor scythes
                ctx.strokeStyle = '#e9d5ff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(10, -14);
                ctx.lineTo(24, -18);
                ctx.moveTo(10, 14);
                ctx.lineTo(24, 18);
                ctx.stroke();
                break;

            case 12: // Annihilator Mech (Boss 3): Supreme war machine
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(0, 0, 24, 0, Math.PI * 2);
                ctx.fill();
                // Antimatter chest reactor
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#f87171';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                // Shoulder missile pods
                ctx.fillStyle = '#334155';
                ctx.fillRect(-12, -24, 24, 8);
                ctx.fillRect(-12, 16, 24, 8);
                // Glowing visor
                ctx.fillStyle = '#facc15';
                ctx.fillRect(16, -3, 8, 6);
                break;
        }

        ctx.restore();
        this.cache.set(`enemy_${variant}`, canvas);
    }

    // Generate projectile sprites
    generateProjectileSprites() {
        // Bullet
        const bullet = this.createCanvas(12, 12);
        bullet.ctx.fillStyle = '#fde047';
        bullet.ctx.beginPath();
        bullet.ctx.arc(6, 6, 3, 0, Math.PI * 2);
        bullet.ctx.fill();
        this.cache.set('proj_bullet', bullet.canvas);

        // Cannon Shell
        const shell = this.createCanvas(16, 16);
        shell.ctx.fillStyle = '#475569';
        shell.ctx.beginPath();
        shell.ctx.arc(8, 8, 5, 0, Math.PI * 2);
        shell.ctx.fill();
        shell.ctx.fillStyle = '#f97316';
        shell.ctx.fillRect(6, 6, 4, 4);
        this.cache.set('proj_cannon', shell.canvas);

        // Ice Shard
        const ice = this.createCanvas(16, 16);
        ice.ctx.fillStyle = '#38bdf8';
        ice.ctx.beginPath();
        ice.ctx.moveTo(12, 8);
        ice.ctx.lineTo(4, 4);
        ice.ctx.lineTo(6, 8);
        ice.ctx.lineTo(4, 12);
        ice.ctx.closePath();
        ice.ctx.fill();
        this.cache.set('proj_ice', ice.canvas);

        // Mortar / Bomber Shell
        const mortar = this.createCanvas(16, 16);
        mortar.ctx.fillStyle = '#b91c1c';
        mortar.ctx.beginPath();
        mortar.ctx.arc(8, 8, 6, 0, Math.PI * 2);
        mortar.ctx.fill();
        mortar.ctx.fillStyle = '#facc15';
        mortar.ctx.fillRect(7, 7, 2, 2);
        this.cache.set('proj_mortar', mortar.canvas);

        // Acid Glob
        const acid = this.createCanvas(16, 16);
        acid.ctx.fillStyle = '#84cc16';
        acid.ctx.beginPath();
        acid.ctx.arc(8, 8, 5, 0, Math.PI * 2);
        acid.ctx.fill();
        acid.ctx.fillStyle = '#bef264';
        acid.ctx.arc(6, 6, 2, 0, Math.PI * 2);
        acid.ctx.fill();
        this.cache.set('proj_acid', acid.canvas);
    }

    // Retrieve cached sprite
    get(key) {
        return this.cache.get(key);
    }
}

window.SpriteGenerator = SpriteGenerator;
