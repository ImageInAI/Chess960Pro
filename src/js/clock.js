/**
 * High-Precision Chess Clock Engine with Increment & Preset Time Controls
 */

export const TIME_PRESETS = [
  { id: '1+0', name: '1 min Bullet', baseSeconds: 60, incrementSeconds: 0 },
  { id: '2+1', name: '2 | 1 Bullet', baseSeconds: 120, incrementSeconds: 1 },
  { id: '3+0', name: '3 min Blitz', baseSeconds: 180, incrementSeconds: 0 },
  { id: '3+2', name: '3 | 2 Blitz', baseSeconds: 180, incrementSeconds: 2 },
  { id: '5+0', name: '5 min Blitz', baseSeconds: 300, incrementSeconds: 0 },
  { id: '5+3', name: '5 | 3 Blitz', baseSeconds: 300, incrementSeconds: 3 },
  { id: '10+0', name: '10 min Rapid', baseSeconds: 600, incrementSeconds: 0 },
  { id: '15+10', name: '15 | 10 Rapid', baseSeconds: 900, incrementSeconds: 10 },
  { id: '30+0', name: '30 min Classical', baseSeconds: 1800, incrementSeconds: 0 },
  { id: 'unlimited', name: 'Unlimited Time', baseSeconds: 0, incrementSeconds: 0 }
];

export class ChessClock {
  constructor({ baseSeconds = 300, incrementSeconds = 0, onTick = null, onTimeout = null } = {}) {
    this.baseSeconds = baseSeconds;
    this.incrementSeconds = incrementSeconds;
    this.onTick = onTick;
    this.onTimeout = onTimeout;

    this.whiteTime = baseSeconds;
    this.blackTime = baseSeconds;
    this.activeColor = null; // 'w', 'b', or null
    this.timerId = null;
    this.lastTimestamp = null;
    this.isRunning = false;
  }

  setPreset(presetId) {
    const preset = TIME_PRESETS.find(p => p.id === presetId) || TIME_PRESETS[4];
    this.baseSeconds = preset.baseSeconds;
    this.incrementSeconds = preset.incrementSeconds;
    this.reset();
  }

  reset() {
    this.stop();
    this.whiteTime = this.baseSeconds;
    this.blackTime = this.baseSeconds;
    this.activeColor = null;
    this.triggerTick();
  }

  start(color = 'w') {
    if (this.baseSeconds === 0) return; // Unlimited mode
    this.activeColor = color;
    this.isRunning = true;
    this.lastTimestamp = performance.now();

    if (this.timerId) clearInterval(this.timerId);

    this.timerId = setInterval(() => {
      if (!this.isRunning || !this.activeColor) return;

      const now = performance.now();
      const deltaSec = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;

      if (this.activeColor === 'w') {
        this.whiteTime = Math.max(0, this.whiteTime - deltaSec);
        if (this.whiteTime <= 0) {
          this.stop();
          if (this.onTimeout) this.onTimeout('w');
        }
      } else if (this.activeColor === 'b') {
        this.blackTime = Math.max(0, this.blackTime - deltaSec);
        if (this.blackTime <= 0) {
          this.stop();
          if (this.onTimeout) this.onTimeout('b');
        }
      }

      this.triggerTick();
    }, 100);
  }

  switchTurn(newColor) {
    if (this.baseSeconds === 0) return;

    // Apply increment to previous turn's player
    if (this.activeColor === 'w') {
      this.whiteTime += this.incrementSeconds;
    } else if (this.activeColor === 'b') {
      this.blackTime += this.incrementSeconds;
    }

    this.activeColor = newColor;
    this.lastTimestamp = performance.now();
    this.triggerTick();
  }

  stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  triggerTick() {
    if (this.onTick) {
      this.onTick({
        whiteTime: this.whiteTime,
        blackTime: this.blackTime,
        activeColor: this.activeColor,
        isUnlimited: this.baseSeconds === 0
      });
    }
  }

  static formatTime(seconds) {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);

    if (mins < 1 && seconds < 20) {
      // Show tenths of a second when under 20s
      return `${secs}.${ms}`;
    }

    const mStr = String(mins).padStart(2, '0');
    const sStr = String(secs).padStart(2, '0');
    return `${mStr}:${sStr}`;
  }
}
