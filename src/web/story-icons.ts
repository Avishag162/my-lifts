/**
 * Gold drawings for the badge icons, for the story medal. Phones don't reliably draw a large emoji on a canvas
 * (it can come out empty), so each badge emoji has its own drawing. Every drawing is made in a box from -100 to 100.
 */
type Draw = (ctx: CanvasRenderingContext2D) => void;

const star = (ctx: CanvasRenderingContext2D, r: number, inner: number, points = 5) => {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 ? inner : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
};

const rrect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const barbell: Draw = (ctx) => {
  rrect(ctx, -96, -6, 192, 12, 6);
  ctx.fill();
  for (const s of [-1, 1]) {
    rrect(ctx, s * 52 - 9, -52, 18, 104, 7);
    ctx.fill();
    rrect(ctx, s * 74 - 8, -38, 16, 76, 6);
    ctx.fill();
  }
};

const plate: Draw = (ctx) => {
  // A weight plate with "KG" on it, for the tons lifted.
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '900 34px Heebo, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KG', 0, -44);
  ctx.restore();
};

const dumbbell: Draw = (ctx) => {
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  barbell(ctx);
  ctx.restore();
};

const ICONS: Record<string, Draw> = {
  '👑': (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-84, 50);
    ctx.lineTo(-92, -40);
    ctx.lineTo(-44, 0);
    ctx.lineTo(0, -66);
    ctx.lineTo(44, 0);
    ctx.lineTo(92, -40);
    ctx.lineTo(84, 50);
    ctx.closePath();
    ctx.fill();
    rrect(ctx, -86, 58, 172, 26, 8);
    ctx.fill();
    for (const [x, y] of [[-92, -50], [0, -78], [92, -50]]) {
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  '🏆': (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-62, -80);
    ctx.lineTo(62, -80);
    ctx.bezierCurveTo(62, 0, 30, 24, 0, 24);
    ctx.bezierCurveTo(-30, 24, -62, 0, -62, -80);
    ctx.fill();
    ctx.lineWidth = 14;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 64, -46, 28, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : (Math.PI * 3) / 2);
      ctx.stroke();
    }
    rrect(ctx, -12, 20, 24, 40, 4);
    ctx.fill();
    rrect(ctx, -50, 58, 100, 16, 6);
    ctx.fill();
    rrect(ctx, -66, 76, 132, 20, 8);
    ctx.fill();
  },
  '🏋️': barbell,
  '🏋': barbell,
  '💪': plate,
  '🦾': dumbbell,
  '⭐': (ctx) => {
    star(ctx, 96, 40);
    ctx.fill();
  },
  '⚡': (ctx) => {
    ctx.beginPath();
    ctx.moveTo(22, -96);
    ctx.lineTo(-58, 12);
    ctx.lineTo(-4, 12);
    ctx.lineTo(-24, 96);
    ctx.lineTo(60, -18);
    ctx.lineTo(6, -18);
    ctx.closePath();
    ctx.fill();
  },
  '🔥': (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 96);
    ctx.bezierCurveTo(-60, 96, -82, 50, -72, 6);
    ctx.bezierCurveTo(-62, -30, -30, -40, -24, -80);
    ctx.bezierCurveTo(10, -60, 20, -30, 14, -6);
    ctx.bezierCurveTo(30, -20, 36, -40, 34, -56);
    ctx.bezierCurveTo(70, -20, 84, 30, 64, 62);
    ctx.bezierCurveTo(52, 84, 30, 96, 0, 96);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(0, 86);
    ctx.bezierCurveTo(-30, 86, -40, 60, -30, 36);
    ctx.bezierCurveTo(-20, 16, 0, 10, 2, -8);
    ctx.bezierCurveTo(26, 14, 40, 44, 30, 66);
    ctx.bezierCurveTo(24, 80, 14, 86, 0, 86);
    ctx.fill();
    ctx.restore();
  },
  '📈': (ctx) => {
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-86, -86);
    ctx.lineTo(-86, 86);
    ctx.lineTo(90, 86);
    ctx.stroke();
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(-60, 50);
    ctx.lineTo(-16, 4);
    ctx.lineTo(14, 32);
    ctx.lineTo(70, -38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(84, -62);
    ctx.lineTo(82, -10);
    ctx.lineTo(36, -50);
    ctx.closePath();
    ctx.fill();
  },
  '🧭': (ctx) => {
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(22, 0);
    ctx.lineTo(0, 70);
    ctx.lineTo(-22, 0);
    ctx.closePath();
    ctx.fill();
  },
  '🚀': (ctx) => {
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -100);
    ctx.bezierCurveTo(36, -70, 36, 10, 26, 46);
    ctx.lineTo(-26, 46);
    ctx.bezierCurveTo(-36, 10, -36, -70, 0, -100);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 26, 0);
      ctx.lineTo(s * 54, 50);
      ctx.lineTo(s * 26, 44);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-16, 56);
    ctx.lineTo(0, 96);
    ctx.lineTo(16, 56);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(0, -36, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  '🌅': (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 30, 52, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (Math.PI / 6) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 68, 30 + Math.sin(a) * 68);
      ctx.lineTo(Math.cos(a) * 92, 30 + Math.sin(a) * 92);
      ctx.stroke();
    }
    rrect(ctx, -96, 42, 192, 14, 7);
    ctx.fill();
    rrect(ctx, -60, 70, 120, 12, 6);
    ctx.fill();
  },
  '🌙': (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(42, -30, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  '🦵': (ctx) => {
    // A kettlebell, for the leg days.
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-42, -10);
    ctx.lineTo(-46, -50);
    ctx.bezierCurveTo(-46, -100, 46, -100, 46, -50);
    ctx.lineTo(42, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 30, 66, 0, Math.PI * 2);
    ctx.fill();
    rrect(ctx, -50, 82, 100, 14, 6);
    ctx.fill();
  },
  '📅': (ctx) => {
    rrect(ctx, -86, -70, 172, 160, 18);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    rrect(ctx, -70, -26, 140, 100, 8);
    ctx.fill();
    ctx.restore();
    for (const x of [-44, 44]) {
      rrect(ctx, x - 9, -96, 18, 44, 9);
      ctx.fill();
    }
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-36, 22);
    ctx.lineTo(-8, 50);
    ctx.lineTo(42, -4);
    ctx.stroke();
  },
  '🧩': (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-70, -70);
    ctx.lineTo(-20, -70);
    ctx.arc(0, -70, 22, Math.PI, 0, false);
    ctx.lineTo(70, -70);
    ctx.lineTo(70, -20);
    ctx.arc(70, 0, 22, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(70, 70);
    ctx.lineTo(-70, 70);
    ctx.lineTo(-70, 20);
    ctx.arc(-70, 0, 22, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
  },
  '🔄': (ctx) => {
    ctx.lineWidth = 18;
    for (const r of [0, Math.PI]) {
      ctx.save();
      ctx.rotate(r);
      ctx.beginPath();
      ctx.arc(0, 0, 72, Math.PI * 0.1, Math.PI * 0.85);
      ctx.stroke();
      const a = Math.PI * 0.1;
      const x = Math.cos(a) * 72;
      const y = Math.sin(a) * 72;
      ctx.beginPath();
      ctx.moveTo(x - 30, y - 6);
      ctx.lineTo(x + 30, y - 6);
      ctx.lineTo(x, y - 44);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },
  '🎂': (ctx) => {
    rrect(ctx, -86, 10, 172, 80, 14);
    ctx.fill();
    rrect(ctx, -64, -40, 128, 56, 12);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 8;
    for (const y of [-14, 44]) {
      ctx.beginPath();
      for (let x = -90; x <= 90; x += 4) ctx.lineTo(x, y + Math.sin(x / 9) * 6);
      ctx.stroke();
    }
    ctx.restore();
    for (const x of [-34, 0, 34]) {
      rrect(ctx, x - 6, -80, 12, 36, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, -106);
      ctx.quadraticCurveTo(x + 12, -90, x, -84);
      ctx.quadraticCurveTo(x - 12, -90, x, -106);
      ctx.fill();
    }
  },
  '🎯': (ctx) => {
    ctx.lineWidth = 14;
    for (const r of [84, 54]) {
      ctx.beginPath();
      ctx.arc(-6, 6, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(-6, 6, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.lineTo(70, -70);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(60, -98);
    ctx.lineTo(98, -60);
    ctx.lineTo(76, -54);
    ctx.lineTo(66, -76);
    ctx.closePath();
    ctx.fill();
  },
  '🎖️': (ctx) => medal(ctx),
  '🎖': (ctx) => medal(ctx),
  '🥇': (ctx) => medal(ctx, '1'),
  '✅': (ctx) => {
    rrect(ctx, -86, -86, 172, 172, 36);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-44, 4);
    ctx.lineTo(-10, 38);
    ctx.lineTo(48, -30);
    ctx.stroke();
    ctx.restore();
  },
  '📍': (ctx) => {
    ctx.beginPath();
    ctx.arc(0, -30, 62, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(0, 96);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(0, -30, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  '👥': (ctx) => {
    const person = (x: number, y: number, s: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.arc(0, -40, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-64, 84);
      ctx.bezierCurveTo(-64, 10, 64, 10, 64, 84);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    // The one behind, then a gap around the one in front, then the one in front.
    person(36, -12, 0.85);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.arc(-24, -40, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-88, 84);
    ctx.bezierCurveTo(-88, 10, 40, 10, 40, 84);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    person(-24, 0, 1);
  },
};

/** A medal on a ribbon, with a star, or a number on it. */
function medal(ctx: CanvasRenderingContext2D, label?: string) {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 18, -20);
    ctx.lineTo(s * 60, -100);
    ctx.lineTo(s * 22, -100);
    ctx.lineTo(s * -14, -36);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 30, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 30, 52, 0, Math.PI * 2);
  ctx.stroke();
  if (label) {
    ctx.font = '900 76px Heebo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 36);
  } else {
    ctx.translate(0, 32);
    star(ctx, 36, 15);
    ctx.fill();
  }
  ctx.restore();
}

export const hasIconDrawing = (icon: string) => icon in ICONS;

/** Draws the badge's icon in gold, `size` pixels across, centred on (cx, cy). False when there is no drawing for it. */
export function drawIcon(ctx: CanvasRenderingContext2D, icon: string, cx: number, cy: number, size: number): boolean {
  const draw = ICONS[icon];
  if (!draw) return false;
  // Drawn on its own layer, so the cut-outs only cut the icon and not the medal under it.
  const layer = document.createElement('canvas');
  layer.width = layer.height = Math.ceil(size * 1.1);
  const l = layer.getContext('2d')!;
  const gold = l.createLinearGradient(0, 0, layer.width, layer.height);
  gold.addColorStop(0, '#FFF1B8');
  gold.addColorStop(0.45, '#F6C450');
  gold.addColorStop(1, '#D9971F');
  l.translate(layer.width / 2, layer.height / 2);
  l.scale(size / 200, size / 200);
  l.fillStyle = gold;
  l.strokeStyle = gold;
  draw(l);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(layer, cx - layer.width / 2, cy - layer.height / 2);
  ctx.restore();
  return true;
}
