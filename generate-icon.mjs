import { createCanvas, registerFont } from 'canvas';
import { writeFileSync } from 'fs';

// Register a real bold font
registerFont('/System/Library/Fonts/Supplemental/Arial Bold.ttf', { family: 'ArialB', weight: 'bold' });
registerFont('/System/Library/Fonts/Supplemental/Arial Black.ttf', { family: 'ArialBlack' });

const SIZE = 1024;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Background - rich blue gradient
const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
bgGrad.addColorStop(0, '#3B8BF2');
bgGrad.addColorStop(0.5, '#1A5EC4');
bgGrad.addColorStop(1, '#0E3D8C');

ctx.fillStyle = bgGrad;
ctx.fillRect(0, 0, SIZE, SIZE);

// Subtle inner glow from top-left
const glowGrad = ctx.createRadialGradient(280, 220, 50, 512, 512, 750);
glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
ctx.fillStyle = glowGrad;
ctx.fillRect(0, 0, SIZE, SIZE);

// White circle behind the dollar sign
ctx.beginPath();
ctx.arc(SIZE / 2, SIZE / 2, 340, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
ctx.fill();

// Dollar sign shadow
ctx.font = '720px ArialBlack';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
ctx.fillText('$', SIZE / 2 + 5, SIZE / 2 + 20);

// Dollar sign main
ctx.fillStyle = '#FFFFFF';
ctx.fillText('$', SIZE / 2, SIZE / 2 + 15);

// Subtle red accent triangle at bottom-right
ctx.save();
ctx.globalAlpha = 0.2;
ctx.fillStyle = '#E74C3C';
ctx.beginPath();
ctx.moveTo(SIZE, SIZE * 0.85);
ctx.lineTo(SIZE, SIZE);
ctx.lineTo(SIZE * 0.85, SIZE);
ctx.closePath();
ctx.fill();
ctx.restore();

// Write file
const buffer = canvas.toBuffer('image/png');
const outputPath = '/Users/bmccloskey/Projects/democrat-dollar/app/DemocratDollar/Resources/Assets.xcassets/AppIcon.appiconset/app-icon-1024.png';
writeFileSync(outputPath, buffer);
console.log(`Icon written to ${outputPath} (${buffer.length} bytes)`);
writeFileSync('/tmp/democratdollar-icon.png', buffer);
console.log('Copy saved to /tmp/democratdollar-icon.png');
