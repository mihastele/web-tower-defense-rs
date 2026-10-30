# Cyber Bastion: Cross-Platform WebAssembly Tower Defense

An action-packed, cross-platform Tower Defense strategy game featuring **real-time dynamic mazing**, **tower attackers & bosses**, procedural pixel-art sprites, and a **high-performance WebAssembly simulation engine**.

---

## 🎮 Key Features & Mechanics

### 1. Multi-Level Campaign & Dynamic Mazing
- **Level Progression & Unlocking**:
  - **Sector 1: Frontier Canyon** (Open Sandbox Arena): Wide open tactical plain for custom maze routing. Unlocked by default.
  - **Sector 2: Circuit Labyrinth** (Double S-Curve Path): 3x longer serpentine canyon with dual industrial dividing barriers. Unlocked by beating **Wave 10** on Sector 1!
  - **Sector 3: Serpentine Slalom** (Vertical Zigzag): Alternating vertical barrier pillars creating tight defensive chokepoints. Unlocked by beating **Wave 10** on Sector 2!
  - **Sector 4: Citadel Gauntlet** (Perimeter Spiral to Center): Perimeter ring route that spirals inward to the central core. Unlocked by beating **Wave 10** on Sector 3!
  - **Sector 5: Omega Core** (The Abyssal Crucible): Symmetrical bifurcating energy baffles creating twin tactical arenas. Unlocked by beating **Wave 10** on Sector 4!
- **Dynamic Energy Flow Visualizer**: Real-time animated neon energy line shows the active optimal pathing through your maze.
- **BFS Reachability Algorithm**: Towers can be placed anywhere along corridors and path tiles, but **cannot completely block off the path to the Core**.

### 2. Dual Enemy Archetypes & Diverse Variations
Enemies come in two distinct behavioral archetypes, plus multi-phase Boss encounters:

#### A. Walkers (Path Traversers)
These enemies weave through your maze toward the Core:
1. **Scout Drone**: Swift recon unit with high movement speed.
2. **Armored Juggernaut**: Hulking iron brute with 50% physical damage resistance.
3. **Phantom Wraith**: Ethereal ghost unit immune to frost slow effects.
4. **Healer Drone**: Radiates a green regeneration aura to nearby wounded allies.
5. **Swarm Beetle**: Fast, fragile insectoids deployed in dense packs.

#### B. Tower Attackers (Siege & Breakers)
These enemies **actively attack and destroy your towers** to breach your maze:
6. **Siege Brawler**: Heavy melee gorilla that pummels blocking towers with hydraulic battering rams.
7. **Artillery Bombardier**: Long-range mortar beetle that bombards towers from afar.
8. **Suicide Bomber**: Spiked volatile crawler that detonates on tower contact, inflicting heavy area damage.
9. **EMP Disruptor**: Emits an electromagnetic shockwave that temporarily stuns and disables towers for 3.5 seconds.
10. **Acid Spitter**: Launches corrosive toxic bile that eats away tower health over time.

#### C. Supreme Boss Encounters & Exponential Cataclysm Difficulty
11. **Titan Colossus (Wave 5 Boss)**: Massive quadruped walking fortress that unleashes ground-shaking seismic stomps against nearby towers.
12. **Broodmother Queen (Wave 10 Boss)**: Giant alien hive matriarch that continually hatches swarms of runner and siege minions while spraying acid.
13. **Annihilator Dreadnought (Wave 15+ Boss)**: Antimatter assault mech with chest reactor beams and high-yield orbital strikes.

#### D. Exponential Cataclysm Surges (Every 4 Waves After Titan Spawn)
Starting after the first Titan Colossus appears on **Wave 5**, the invasion enters brutal **Exponential Cataclysm Surges** every 4 waves:
- **Wave 9 (Surge I - 4 waves after Titan)**: +175% Threat Multiplier! Titan Colossus returns escorted by heavy siege brawlers, acid spitters, and EMP disruptors.
- **Wave 13 (Surge II - 8 waves after Titan)**: +306% Threat Multiplier! Dual-Boss Cataclysm: Titan Colossus AND Broodmother Queen deploy simultaneously!
- **Wave 17 (Surge III - 12 waves after Titan)**: +536% Threat Multiplier! Annihilator Dreadnought AND Titan Colossus siege vanguard!
- **Wave 21 (Surge IV - 16 waves after Titan)**: +938% Threat Multiplier! The Apocalypse Trinity: All three bosses arrive together with massive demolition hordes!
- **Endless Waves (15+)**: Cataclysm Surges scale exponentially (`1.75^tier`), ramping enemy HP, attack damage against towers, and sprint movement speeds!

#### E. Elite Enemy Affixes & Mutations
During high waves and cataclysm surges, hostiles have a high chance to roll deadly Elite Mutations:
- **🛡️ Kinetic Shield**: Absorbs up to 45% of maximum HP in a protective cyan energy bubble before taking damage.
- **⚡ Berserk**: Enraged fire aura, granting +30% movement speed and 35% faster attack rate against towers!
- **💚 Regenerator**: Bio-nanite infusion regenerating 3% maximum HP every second.
- **⛓️ Juggernaut Armor**: Heavy armor plating granting 35% flat damage reduction from all physical weapons!

---

### 3. Tactical Commander Superweapons
To counter overwhelming exponential surges, commanders have 3 orbital tactical abilities with active cooldowns:
1. **⚡ Orbital EMP Blast (Hotkey: `Q`)**: Discharges an ion pulse across the entire arena, stunning all hostiles for 3.5s and immediately rebooting disabled friendly towers.
2. **💥 Kinetic Orbital Strike (Hotkey: `E`)**: Calls down high-explosive orbital artillery onto target coordinates (or heaviest hostile cluster), dealing 950 area damage with screen-shaking impact.
3. **🛡️ Bastion Overdrive (Hotkey: `F`)**: Emergency nanite surge: instantly repairs 35% HP to all placed towers and overclocks all weapons with 2x fire rate for 8 seconds.

---

### 4. Dynamic Tower Targeting Priority & Kill Tracking
Every tower features real-time targeting priority configuration (Hotkey: `T` or Inspection Panel button):
- **FIRST**: Targets the enemy furthest along the path closest to the Core.
- **STRONGEST**: Focuses high-HP targets (essential for Snipers & Lasers melting Titans and Bosses!).
- **WEAKEST**: Prioritizes low-health runners to quickly cull swarms.
- **CLOSEST**: Targets the nearest hostile to the tower.
- **Kill Tracking**: Each tower keeps a permanent kill counter and damage stats throughout the battle!

---

### 5. Arsenal of 8 Towers & 3 Upgrade Tiers (24 Unique Sprites)
Every tower features 3 distinct visual tiers (base, turret barrels, glowing energy coils, armor plates):

1. **Gatling Turret**: High rate of fire, rapid physical damage.
   - *Tier 1*: Single Barrel Autocannon
   - *Tier 2*: Twin Rotary Miniguns
   - *Tier 3*: Quad Hyper-Vulcan
2. **Heavy Cannon**: Long-range artillery with explosive AOE splash.
   - *Tier 1*: Light Mortar
   - *Tier 2*: Heavy Howitzer
   - *Tier 3*: Dual Nuclear Siege Cannons
3. **Cryo Spire**: Chills enemies, reducing their movement speed.
   - *Tier 1*: Ice Emitter
   - *Tier 2*: Blizzard Spire
   - *Tier 3*: Absolute Zero Glacier Obelisk
4. **Tesla Coil**: Discharges high-voltage chain lightning across up to 6 targets.
   - *Tier 1*: Spark Pylon
   - *Tier 2*: Arc Generator
   - *Tier 3*: Storm Obliterator
5. **Flamethrower**: Projects a cone of continuous napalm inflicting stacking burn DoT.
   - *Tier 1*: Fire Jet
   - *Tier 2*: Inferno Projector
   - *Tier 3*: Hellfire Plasma Torch
6. **Sniper Railgun**: Extreme range, high-caliber armor-penetrating anti-boss rifle.
   - *Tier 1*: Precision Rifle
   - *Tier 2*: Gauss Accelerator
   - *Tier 3*: Orbital Kinetic Railgun
7. **Laser Melter**: Continuous beam weapon that exponentially increases damage against a single target.
   - *Tier 1*: Ruby Laser
   - *Tier 2*: Prismatic Beam
   - *Tier 3*: Tachyon Death Ray
8. **Aegis Beacon**: Support station that continuously repairs damaged towers in its radius and boosts adjacent fire rates.
   - *Tier 1*: Nanite Station
   - *Tier 2*: Shield Generator
   - *Tier 3*: Bastion Core

---

## 🛠️ Technology Stack

- **Simulation Core**: **Rust compiled directly to WebAssembly (`wasm32-unknown-unknown`)**
  - Instant zero-allocation memory buffer sharing via raw pointers and typed arrays (`Float32Array`).
  - Ultra-fast BFS path reachability validation (< 0.1ms per frame).
  - Deterministic 60 FPS combat physics, entity component processing, and status effect management.
- **Visuals**: **Procedural Canvas 2D Pixel Art Generator**
  - Generates 24 tower sprites (with decoupled rotating turret heads), 13 enemy/boss sprites, projectiles, and particle effects directly in-browser.
  - Zero external image assets required — completely self-contained!
- **Audio**: **Synthesized Web Audio API Sound Engine**
  - Procedural sound effects for all guns, explosions, lasers, ice chimes, and alarms, plus an optional retro cyber synth background track.
  - Toggleable SFX and music.
- **Controls & UI**: Modern HTML5/CSS3 HUD with hotkeys, interactive inspection panel, repair/sell actions, early wave calling bonus, and a built-in Bestiary & Sprite Gallery.

---

## 🚀 Quick Start Guide

### 1. Build WebAssembly (Optional, already pre-compiled)
If you have Rust installed with `wasm32-unknown-unknown`:
```powershell
.\build.bat       # Windows
# or ./build.sh   # Linux / macOS
```

### 2. Launch Local Server & Play
Run the included lightweight Python server:
```powershell
python server.py
```
Open your browser and navigate to:
```
http://localhost:8080
```

---

## ⌨️ Controls & Hotkeys

- **`1` - `8`**: Select Tower from hotbar
- **`Left Click`**: Place tower on grid / Select existing tower to inspect
- **`Q`**: ⚡ Orbital EMP Blast (Commander Ability)
- **`E`**: 💥 Kinetic Orbital Strike at cursor / target (Commander Ability)
- **`F`**: 🛡️ Bastion Overdrive - 2x fire rate & repair (Commander Ability)
- **`T`**: Cycle targeting priority (`FIRST` → `STRONGEST` → `WEAKEST` → `CLOSEST`)
- **`U`**: Upgrade selected tower to next tier
- **`R`**: Repair damaged tower
- **`S`**: Sell selected tower (70% gold refund)
- **`Space`**: Start next wave / Call wave early for bonus gold
- **`Esc`**: Deselect tower / Cancel placement
- **`Speed Buttons`**: ⏸ Pause, 1x, 2x, 4x speed multipliers
- **`Bestiary Button`**: View high-res sprite cards and lore for all towers and enemies
