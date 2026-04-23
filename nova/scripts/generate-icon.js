// Kör med: node scripts/generate-icon.js
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  // Bakgrund
  ctx.fillStyle = '#0A0A0F';
  ctx.fillRect(0, 0, size, size);

  // Nebulosa-glöd (yttre)
  const outerGlow = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy * 0.85, size * 0.6);
  outerGlow.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
  outerGlow.addColorStop(0.5, 'rgba(236, 72, 153, 0.15)');
  outerGlow.addColorStop(1, 'rgba(10, 10, 15, 0)');
  ctx.fillStyle = outerGlow;
  ctx.fillRect(0, 0, size, size);

  // Nebulosa-glöd (inre, varmare)
  const innerGlow = ctx.createRadialGradient(cx * 1.1, cy * 0.75, 0, cx, cy * 0.9, size * 0.35);
  innerGlow.addColorStop(0, 'rgba(236, 72, 153, 0.4)');
  innerGlow.addColorStop(0.6, 'rgba(168, 85, 247, 0.2)');
  innerGlow.addColorStop(1, 'rgba(10, 10, 15, 0)');
  ctx.fillStyle = innerGlow;
  ctx.fillRect(0, 0, size, size);

  // Stjärnor
  const stars = [
    [0.15, 0.12, 1.8], [0.82, 0.08, 1.4], [0.92, 0.22, 1.0],
    [0.08, 0.35, 1.2], [0.88, 0.45, 1.6], [0.12, 0.65, 1.0],
    [0.78, 0.70, 1.4], [0.25, 0.88, 1.2], [0.68, 0.90, 1.0],
    [0.55, 0.10, 0.8], [0.35, 0.18, 1.0], [0.72, 0.28, 0.6],
    [0.18, 0.48, 0.8], [0.90, 0.58, 0.6], [0.42, 0.82, 0.8],
  ];
  stars.forEach(([rx, ry, r]) => {
    ctx.beginPath();
    ctx.arc(rx * size, ry * size, r * (size / 512), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.random() * 0.5})`;
    ctx.fill();
  });

  // "N" bokstav — gradient
  const letterGrad = ctx.createLinearGradient(cx - size * 0.22, cy - size * 0.22, cx + size * 0.22, cy + size * 0.22);
  letterGrad.addColorStop(0, '#ffffff');
  letterGrad.addColorStop(0.4, '#E9D5FF');
  letterGrad.addColorStop(1, '#F9A8D4');

  const lw = size * 0.085;
  const x1 = cx - size * 0.21;
  const x2 = cx + size * 0.21;
  const y1 = cy - size * 0.24;
  const y2 = cy + size * 0.24;

  ctx.strokeStyle = letterGrad;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y2);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2, y1);
  ctx.stroke();

  // Spara
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ ${path.basename(outputPath)} (${size}x${size})`);
}

const assetsDir = path.join(__dirname, '..', 'assets');
generateIcon(1024, path.join(assetsDir, 'icon.png'));
generateIcon(1024, path.join(assetsDir, 'adaptive-icon.png'));
generateIcon(200,  path.join(assetsDir, 'splash-icon.png'));
generateIcon(48,   path.join(assetsDir, 'favicon.png'));
console.log('\nKlart! Starta om Expo för att se den nya ikonen.');
