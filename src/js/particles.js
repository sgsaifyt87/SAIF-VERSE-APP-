// path: src/js/particles.js
// context: javascript / particles.js / browser-canvas / target: mobile-android

export class ParticleEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.particles = [];
    this.maxParticles = 55;
    this.mode = 'cherry_blossom';
    this.wind = { x: 0.5, y: 1.2, speed: 0.001, t: 0 };
    this.isRunning = false;
    this.animationFrameId = null;
    this.lastWidth = 0;
    this.lastHeight = 0;

    this.resize = this.resize.bind(this);
    this.animate = this.animate.bind(this);
    this.handleTouch = this.handleTouch.bind(this);

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => {
      // Avoid rapid keyboard resize flicker
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(this.resize, 150);
    });
    window.addEventListener('pointermove', this.handleTouch, { passive: true });
    window.addEventListener('pointerdown', this.handleTouch, { passive: true });
    this.spawnAll();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Only reinitialize if dimensions meaningfully changed
    if (Math.abs(w - this.lastWidth) < 10 && Math.abs(h - this.lastHeight) < 100) {
      return;
    }

    this.lastWidth = w;
    this.lastHeight = h;
    this.width = w;
    this.height = h;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  handleTouch(e) {
    const x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : this.width / 2);
    // Smooth gust towards touch direction
    const delta = (x - this.width / 2) * 0.0008;
    this.wind.x = Math.max(-1.5, Math.min(1.5, this.wind.x + delta));
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.spawnAll();
  }

  spawnParticle(randomY = false) {
    const y = randomY ? Math.random() * this.height : -20 - Math.random() * 40;
    const x = Math.random() * (this.width + 100) - 50;
    const size = Math.random() * 10 + 7;
    const speedY = Math.random() * 1.5 + 0.8;
    const speedX = (Math.random() - 0.5) * 0.6;
    const rotation = Math.random() * Math.PI * 2;
    const rotationSpeed = (Math.random() - 0.5) * 0.04;
    const flipSpeed = Math.random() * 0.03 + 0.01;
    const flip = Math.random() * Math.PI;
    const opacity = Math.random() * 0.5 + 0.45;

    return {
      x,
      y,
      size,
      speedX,
      speedY,
      rotation,
      rotationSpeed,
      flip,
      flipSpeed,
      opacity,
      swayOffset: Math.random() * Math.PI * 2
    };
  }

  spawnAll() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.spawnParticle(true));
    }
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.animate();
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  drawPetal(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    const scaleY = Math.cos(p.flip);
    ctx.scale(1, scaleY);

    if (this.mode === 'cherry_blossom') {
      const grad = ctx.createLinearGradient(0, -p.size, 0, p.size);
      grad.addColorStop(0, `rgba(255, 220, 235, ${p.opacity})`);
      grad.addColorStop(0.6, `rgba(255, 175, 204, ${p.opacity})`);
      grad.addColorStop(1, `rgba(244, 114, 182, ${p.opacity * 0.8})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.bezierCurveTo(p.size * 0.8, -p.size * 0.5, p.size * 0.7, p.size * 0.6, 0, p.size);
      ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.6, -p.size * 0.8, -p.size * 0.5, 0, -p.size);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.35})`;
      ctx.beginPath();
      ctx.arc(0, -p.size * 0.7, p.size * 0.15, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.mode === 'amber_sun') {
      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, p.size * 0.8);
      grad.addColorStop(0, `rgba(253, 224, 71, ${p.opacity})`);
      grad.addColorStop(0.5, `rgba(245, 158, 11, ${p.opacity * 0.6})`);
      grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.mode === 'cyan_pulse') {
      ctx.fillStyle = `rgba(56, 189, 248, ${p.opacity})`;
      ctx.fillRect(-p.size * 0.15, -p.size, p.size * 0.3, p.size * 2);
    } else if (this.mode === 'purple_nebula') {
      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, p.size);
      grad.addColorStop(0, `rgba(192, 132, 252, ${p.opacity})`);
      grad.addColorStop(0.6, `rgba(147, 51, 234, ${p.opacity * 0.4})`);
      grad.addColorStop(1, 'rgba(126, 34, 206, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(250, 204, 21, ${p.opacity})`;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  animate() {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.wind.t += this.wind.speed;
    const dynamicWind = Math.sin(this.wind.t) * 0.8 + this.wind.x;
    // Gradually ease touch wind back to neutral
    this.wind.x *= 0.98;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.y += p.speedY;
      p.x += p.speedX + dynamicWind + Math.sin(p.swayOffset + this.wind.t * 2) * 0.4;
      p.rotation += p.rotationSpeed;
      p.flip += p.flipSpeed;

      this.drawPetal(p);

      if (p.y > this.height + 30 || p.x > this.width + 60 || p.x < -60) {
        this.particles[i] = this.spawnParticle(false);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  }
}
