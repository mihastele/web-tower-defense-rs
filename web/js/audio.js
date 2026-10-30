// Web Audio API Procedural Sound Engine
// 100% synthesized sound effects & retro cyber soundtrack with zero external dependencies!

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.sfxEnabled = true;
        this.musicEnabled = false;
        this.masterVolume = 0.5;
        this.musicVolume = 0.25;
        this.musicInterval = null;
        this.musicStep = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Generic tone helper
    playTone(freq, type, duration, startVol = 0.3, endVol = 0.001) {
        if (!this.sfxEnabled) return;
        this.init();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(startVol * this.masterVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(endVol, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio context not allowed before gesture
        }
    }

    // Noise buffer helper for explosions and gunfire
    playNoise(duration, filterFreq = 800, volume = 0.3) {
        if (!this.sfxEnabled) return;
        this.init();
        try {
            const bufferSize = this.ctx.sampleRate * duration;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + duration);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start();
        } catch (e) {}
    }

    // Sound effect: Gatling Gun
    playGatling() {
        this.playTone(280 + Math.random() * 80, 'square', 0.05, 0.15);
    }

    // Sound effect: Cannon boom
    playCannon() {
        this.playNoise(0.4, 600, 0.4);
        this.playTone(90, 'sine', 0.3, 0.4);
    }

    // Sound effect: Cryo frost chime
    playCryo() {
        this.playTone(880, 'sine', 0.15, 0.18);
        setTimeout(() => this.playTone(1174, 'triangle', 0.12, 0.15), 40);
    }

    // Sound effect: Tesla lightning zap
    playTesla() {
        this.playTone(420 + Math.random() * 300, 'sawtooth', 0.09, 0.25);
    }

    // Sound effect: Flamethrower
    playFlame() {
        this.playNoise(0.12, 350, 0.18);
    }

    // Sound effect: Sniper railgun
    playSniper() {
        this.playTone(1400, 'sawtooth', 0.12, 0.3);
        this.playNoise(0.25, 1200, 0.3);
    }

    // Sound effect: Laser beam tick
    playLaser() {
        this.playTone(600 + Math.sin(Date.now() * 0.02) * 150, 'sawtooth', 0.04, 0.08);
    }

    // Sound effect: Explosion
    playExplosion(size = 1.0) {
        this.playNoise(0.5 * size, 500, 0.5 * size);
        this.playTone(60, 'sine', 0.4 * size, 0.5);
    }

    // Sound effect: EMP Pulse
    playEMP() {
        if (!this.sfxEnabled) return;
        this.init();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.6);

            gain.gain.setValueAtTime(0.35 * this.masterVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.6);
        } catch (e) {}
    }

    // Sound effect: Acid splash
    playAcid() {
        this.playTone(320, 'sine', 0.18, 0.2);
        this.playNoise(0.2, 400, 0.2);
    }

    // Sound effect: Tower Placement
    playBuild() {
        this.playTone(330, 'triangle', 0.1, 0.3);
        setTimeout(() => this.playTone(440, 'triangle', 0.15, 0.3), 60);
    }

    // Sound effect: Tower Upgrade
    playUpgrade() {
        this.playTone(392, 'sine', 0.08, 0.3);
        setTimeout(() => this.playTone(523.25, 'sine', 0.08, 0.3), 70);
        setTimeout(() => this.playTone(659.25, 'triangle', 0.18, 0.35), 140);
    }

    // Sound effect: Tower Repair
    playRepair() {
        this.playTone(523, 'sine', 0.1, 0.25);
        setTimeout(() => this.playTone(659, 'sine', 0.1, 0.25), 80);
    }

    // Sound effect: Tower Sell
    playSell() {
        this.playTone(784, 'triangle', 0.08, 0.25);
        setTimeout(() => this.playTone(587, 'triangle', 0.12, 0.2), 60);
    }

    // Sound effect: Invalid action / Path Blocked error
    playError() {
        this.playTone(150, 'sawtooth', 0.15, 0.3);
    }

    // Sound effect: Boss Arrival Siren
    playBossAlarm() {
        if (!this.sfxEnabled) return;
        this.playTone(440, 'sawtooth', 0.3, 0.4);
        setTimeout(() => this.playTone(370, 'sawtooth', 0.4, 0.4), 280);
    }

    // Sound effect: Tactical EMP Blast
    playEmpBlast() {
        if (!this.sfxEnabled) return;
        this.init();
        this.playTone(1200, 'sawtooth', 0.15, 0.35);
        setTimeout(() => {
            this.playTone(300, 'sine', 0.6, 0.45);
            this.playNoise(0.5, 400, 0.3);
        }, 120);
    }

    // Sound effect: Tactical Kinetic Orbital Strike
    playOrbitalStrike() {
        if (!this.sfxEnabled) return;
        this.init();
        // Whistle down
        this.playTone(1800, 'sine', 0.25, 0.25, 0.05);
        setTimeout(() => {
            // Earth-shattering impact
            this.playNoise(0.8, 900, 0.6);
            this.playTone(55, 'sawtooth', 0.7, 0.6);
        }, 220);
    }

    // Sound effect: Bastion Overdrive Activation
    playOverdrive() {
        if (!this.sfxEnabled) return;
        this.init();
        this.playTone(220, 'triangle', 0.1, 0.3);
        setTimeout(() => this.playTone(330, 'triangle', 0.1, 0.35), 80);
        setTimeout(() => this.playTone(440, 'sawtooth', 0.1, 0.4), 160);
        setTimeout(() => this.playTone(660, 'sawtooth', 0.3, 0.45), 240);
    }

    // Background synth music sequencer
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (this.musicEnabled) {
            this.startMusic();
        } else {
            this.stopMusic();
        }
        return this.musicEnabled;
    }

    startMusic() {
        this.init();
        if (this.musicInterval) return;

        // Bassline and cyber arpeggio patterns
        const bassNotes = [110, 110, 98, 98, 87.3, 87.3, 123.4, 123.4];
        const arpNotes = [220, 330, 261.6, 392, 196, 293.6, 246.9, 370];

        this.musicInterval = setInterval(() => {
            if (!this.musicEnabled) return;
            const bass = bassNotes[this.musicStep % bassNotes.length];
            const arp = arpNotes[(this.musicStep * 2) % arpNotes.length];

            // Bass pulse
            if (this.musicStep % 2 === 0) {
                this.playTone(bass, 'triangle', 0.22, this.musicVolume * 0.7);
            }
            // Arp tick
            this.playTone(arp, 'sine', 0.08, this.musicVolume * 0.35);

            this.musicStep = (this.musicStep + 1) % 16;
        }, 220);
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

window.SoundEngine = SoundEngine;
