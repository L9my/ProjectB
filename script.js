const container = document.getElementById('scene-container');
const overlay = document.getElementById('overlay');
const enterBtn = document.getElementById('enter-btn');
const statusEl = document.getElementById('status');

let canvas, ctx;
let animationId;
let angle = 0;

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function createCanvas() {
  canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  container.innerHTML = '';
  container.appendChild(canvas);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawLayer(y, height, radius, color) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2 + y;
  const shadowOffset = 10;

  const gradient = ctx.createLinearGradient(cx, cy - height / 2, cx, cy + height / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, '#1b1b1b');

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.ellipse(0, height / 2, radius, radius * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#00000055';
  ctx.filter = 'blur(10px)';
  ctx.fill();
  ctx.filter = 'none';

  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.restore();
}

function drawCandle(x, y) {
  const baseY = window.innerHeight / 2 + y;
  const cx = window.innerWidth / 2 + x;

  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(angle);

  ctx.fillStyle = '#fff';
  ctx.fillRect(-4, -40, 8, 40);

  ctx.beginPath();
  ctx.ellipse(0, -40, 10, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe28a';
  ctx.fill();

  ctx.restore();
}

function drawPlate() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2 + 120;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.ellipse(0, 0, 260, 90, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScene() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  drawPlate();

  drawLayer(80, 60, 180, '#ff6392');
  drawLayer(10, 70, 150, '#ff9f1c');
  drawLayer(-70, 80, 120, '#2ec4b6');

  drawCandle(50, -150);
  drawCandle(-40, -150);
  drawCandle(0, -180);
}

function animate() {
  angle += 0.0035;
  drawScene();
  animationId = requestAnimationFrame(animate);
}

function startExperience() {
  if (animationId) return;
  setStatus('');
  overlay.classList.add('hidden');
  createCanvas();
  animate();
}

enterBtn.addEventListener('click', startExperience);
