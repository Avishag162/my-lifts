import { APP_NAME } from './Logo.tsx';
// A 1080×1920 image of the workout summary, sized for Instagram / WhatsApp stories.
import { drawIcon } from './story-icons';
import { asset } from './asset.ts';

export interface StoryData {
  firstName: string;
  classType: string;
  startsAt: string;
  totalKg: number;
  sets: number;
  prs: { name: string; weight: number | null; reps: number }[];
  exercises: { name: string; top: string }[];
}

const W = 1080;
const H = 1920;
const PAD = 90;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cuts text to fit a width, ending with "…". */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

// ---------- Shared look ----------

export type StoryKind = 'crown' | 'strength' | 'streak' | 'volume' | 'record' | 'habit' | 'milestone' | 'workout';

/** Each kind of badge has its own colours; the workout summary uses purple with gold. */
const THEMES: Record<StoryKind, { from: string; to: string; glow: string; accent: string }> = {
  crown: { from: '#2A1033', to: '#0E0612', glow: '#FFC94A', accent: '#FFD873' },
  strength: { from: '#7A2E7E', to: '#2B0F33', glow: '#FF7AC6', accent: '#FFD873' },
  streak: { from: '#8A2B12', to: '#2A0B10', glow: '#FF8A3D', accent: '#FFC56B' },
  volume: { from: '#3B2A8F', to: '#140B33', glow: '#8C7CFF', accent: '#FFD873' },
  record: { from: '#8E3D8E', to: '#2E0F3A', glow: '#FFE08A', accent: '#FFE08A' },
  habit: { from: '#1F6F78', to: '#14213D', glow: '#5BE3D3', accent: '#B9FFF4' },
  milestone: { from: '#9A62A0', to: '#3A1C42', glow: '#E7B6F0', accent: '#FFE08A' },
  workout: { from: '#9A62A0', to: '#2A0F33', glow: '#FF9EDB', accent: '#FFD873' },
};

/** A small deterministic random, so the same badge always draws the same confetti. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function background(ctx: CanvasRenderingContext2D, kind: StoryKind, seed: string, center: [number, number]) {
  const t = THEMES[kind];
  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, t.from);
  bg.addColorStop(1, t.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // A glow behind the hero, with light rays.
  const glow = ctx.createRadialGradient(center[0], center[1], 0, center[0], center[1], 720);
  glow.addColorStop(0, hexA(t.glow, 0.55));
  glow.addColorStop(0.45, hexA(t.glow, 0.12));
  glow.addColorStop(1, hexA(t.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(center[0], center[1]);
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    const ray = ctx.createLinearGradient(0, 0, 0, -1100);
    ray.addColorStop(0, hexA(t.glow, 0.16));
    ray.addColorStop(1, hexA(t.glow, 0));
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-60, -1100);
    ctx.lineTo(60, -1100);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Confetti.
  const rnd = seeded(seed);
  const colors = [t.accent, t.glow, '#FFFFFF', '#FF9EDB'];
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    if (Math.abs(x - center[0]) < 330 && Math.abs(y - center[1]) < 330) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.globalAlpha = 0.35 + rnd() * 0.5;
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    if (rnd() < 0.5) ctx.fillRect(-9, -4, 18, 8);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, 4 + rnd() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The app's mark and name on a white pill, at the top of every story. */
async function logoPill(ctx: CanvasRenderingContext2D, y: number) {
  const icon = await loadImage(asset('/icon-192.png'));
  const size = 84;
  ctx.save();
  ctx.font = '900 44px Heebo, sans-serif';
  ctx.direction = 'rtl';
  const tw = ctx.measureText(APP_NAME).width;
  const w = size + 24 + tw + 64;
  const x = (W - w) / 2;
  ctx.fillStyle = '#fff';
  roundRect(ctx, x, y, w, size + 36, 32);
  ctx.fill();
  if (icon) ctx.drawImage(icon, x + w - 32 - size, y + 18, size, size);
  ctx.fillStyle = '#2E1636';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(APP_NAME, x + w - 32 - size - 24, y + 18 + size / 2 + 2);
  ctx.restore();
}

function goldText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, accent: string) {
  const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.2);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.55, accent);
  g.addColorStop(1, '#E09A2D');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function footer(ctx: CanvasRenderingContext2D, font: (w: number, s: number) => string) {
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = font(700, 36);
  ctx.fillText(APP_NAME, W / 2, H - 130);
}

const emojiFont = (size: number) => `${size}px "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif`;

export async function drawStory(d: StoryData): Promise<Blob> {
  await Promise.all(['800 90px Heebo', '900 34px Heebo', '700 40px Heebo', '500 40px Heebo'].map((f) => document.fonts.load(f).catch(() => null)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (weight: number, size: number) => `${weight} ${size}px Heebo, system-ui, sans-serif`;
  const theme = THEMES.workout;
  background(ctx, 'workout', `${d.firstName}${d.startsAt}`, [W / 2, 640]);
  await logoPill(ctx, 110);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = font(500, 42);
  const date = new Date(d.startsAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
  ctx.fillText(`${d.classType} · ${date}`, W / 2, 330);
  ctx.fillStyle = '#fff';
  ctx.font = font(800, 84);
  ctx.fillText(fit(ctx, `${d.firstName}, האימון נרשם!`, W - 2 * PAD), W / 2, 440);

  // The hero number: the kilos lifted.
  const total = Math.round(d.totalKg).toLocaleString('he-IL');
  ctx.font = font(800, total.length > 6 ? 190 : 230);
  goldText(ctx, total, W / 2, 700, 230, theme.accent);
  ctx.fillStyle = '#fff';
  ctx.font = font(700, 50);
  ctx.fillText('ק״ג הורמו באימון', W / 2, 790);

  // Two chips: sets and records.
  const chips: [string, string][] = [
    [`${d.sets}`, 'סטים'],
    [`${d.prs.length}`, d.prs.length === 1 ? 'שיא חדש' : 'שיאים חדשים'],
  ];
  const cw = 360;
  const cy = 850;
  chips.forEach(([v, k], i) => {
    const x = W / 2 + (i === 0 ? 20 : -20 - cw);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    roundRect(ctx, x, cy, cw, 150, 40);
    ctx.fill();
    ctx.strokeStyle = i === 1 && d.prs.length ? hexA(theme.accent, 0.9) : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = i === 1 && d.prs.length ? theme.accent : '#fff';
    ctx.font = font(800, 76);
    ctx.fillText(v, x + cw / 2, cy + 82);
    ctx.font = font(500, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(k, x + cw / 2, cy + 128);
  });

  // Records as gold cards, then the rest of the workout.
  ctx.textAlign = 'right';
  const right = W - PAD;
  let y = cy + 230;
  const row = (label: string, value: string, star: boolean) => {
    if (star) {
      ctx.fillStyle = hexA(theme.accent, 0.16);
      roundRect(ctx, PAD - 20, y - 62, W - 2 * PAD + 40, 88, 26);
      ctx.fill();
    }
    ctx.font = font(800, 46);
    const valueW = ctx.measureText(value).width;
    ctx.fillStyle = star ? theme.accent : '#fff';
    ctx.font = font(star ? 800 : 700, 46);
    ctx.fillText(fit(ctx, (star ? '🏆 ' : '') + label, W - 2 * PAD - valueW - 40), right, y);
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.font = font(800, 46);
    ctx.fillText(value, PAD, y);
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    y += 100;
  };
  for (const p of d.prs.slice(0, 3)) row(p.name, p.weight != null ? `${kg(p.weight)} kg × ${p.reps}` : `× ${p.reps}`, true);
  const others = d.exercises.filter((e) => !d.prs.some((p) => p.name === e.name));
  const room = Math.max(0, Math.floor((H - 260 - y) / 100));
  for (const e of others.slice(0, room)) row(e.name, e.top, false);

  footer(ctx, font);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));
}

export interface BadgeStoryData {
  firstName: string;
  icon: string;
  title: string;
  detail: string;
  kind?: StoryKind;
}

/** A 1080×1920 story image for a badge: a medal in the badge's colours, with rays and confetti. */
export async function drawBadgeStory(d: BadgeStoryData): Promise<Blob> {
  await Promise.all(['800 90px Heebo', '900 34px Heebo', '700 40px Heebo', '500 40px Heebo'].map((f) => document.fonts.load(f).catch(() => null)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (weight: number, size: number) => `${weight} ${size}px Heebo, system-ui, sans-serif`;
  const kind = d.kind ?? 'milestone';
  const theme = THEMES[kind];
  const cx = W / 2;
  const cy = 800;
  background(ctx, kind, d.title + d.firstName, [cx, cy]);
  await logoPill(ctx, 110);

  // Ribbon tails behind the medal.
  ctx.fillStyle = kind === 'crown' ? '#B8862B' : hexA(theme.glow, 0.9);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 70, cy + 150);
    ctx.lineTo(cx + side * 200, cy + 470);
    ctx.lineTo(cx + side * 130, cy + 430);
    ctx.lineTo(cx + side * 85, cy + 500);
    ctx.lineTo(cx + side * -10, cy + 190);
    ctx.closePath();
    ctx.fill();
  }
  // The medal: a gold rim, a dark face, the icon.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  const rim = ctx.createLinearGradient(cx - 280, cy - 280, cx + 280, cy + 280);
  rim.addColorStop(0, '#FFF1B8');
  rim.addColorStop(0.35, '#F6C450');
  rim.addColorStop(0.7, '#C98A1E');
  rim.addColorStop(1, '#FFE08A');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, 280, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const face = ctx.createRadialGradient(cx - 60, cy - 80, 20, cx, cy, 240);
  face.addColorStop(0, theme.from);
  face.addColorStop(1, theme.to);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(cx, cy, 236, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexA('#FFE08A', 0.6);
  ctx.lineWidth = 6;
  ctx.setLineDash([4, 14]);
  ctx.beginPath();
  ctx.arc(cx, cy, 214, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!drawIcon(ctx, d.icon, cx, cy, 300)) {
    // No drawing for this icon: a phone may not draw a big emoji on a canvas, so draw it small and enlarge it.
    const small = document.createElement('canvas');
    small.width = small.height = 160;
    const sc = small.getContext('2d')!;
    sc.textAlign = 'center';
    sc.textBaseline = 'middle';
    sc.font = emojiFont(120);
    sc.fillText(d.icon, 80, 86);
    ctx.drawImage(small, cx - 160, cy - 160, 320, 320);
  }
  ctx.textBaseline = 'alphabetic';

  // The words.
  ctx.direction = 'rtl';
  const pillText = kind === 'crown' ? 'תואר' : 'תג חדש';
  ctx.font = font(800, 42);
  const pw = ctx.measureText(pillText).width + 80;
  ctx.fillStyle = theme.accent;
  roundRect(ctx, cx - pw / 2, 1340, pw, 76, 38);
  ctx.fill();
  ctx.fillStyle = theme.to;
  ctx.fillText(pillText, cx, 1393);
  ctx.font = font(800, d.title.length > 12 ? 104 : 124);
  goldText(ctx, fit(ctx, d.title, W - 2 * PAD), cx, 1550, 124, theme.accent);
  ctx.fillStyle = '#fff';
  ctx.font = font(700, 56);
  ctx.fillText(fit(ctx, d.firstName, W - 2 * PAD), cx, 1650);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = font(500, 40);
  ctx.fillText(fit(ctx, d.detail, W - 2 * PAD), cx, 1720);

  footer(ctx, font);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));
}

export interface MonthStoryData {
  firstName: string;
  monthName: string;
  workouts: number;
  tons: number;
  prs: number;
  records: { exercise: string; weight: number | null; reps: number }[];
  topExercise: string | null;
}

async function newStory(kind: StoryKind, seed: string, center: [number, number]) {
  await Promise.all(['800 90px Heebo', '900 34px Heebo', '700 40px Heebo', '500 40px Heebo'].map((f) => document.fonts.load(f).catch(() => null)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  background(ctx, kind, seed, center);
  await logoPill(ctx, 110);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  return { canvas, ctx, font: (weight: number, size: number) => `${weight} ${size}px Heebo, system-ui, sans-serif`, theme: THEMES[kind] };
}
const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));

/** The month in one image: tons, workouts, records. */
export async function drawMonthStory(d: MonthStoryData): Promise<Blob> {
  const { canvas, ctx, font, theme } = await newStory('volume', d.firstName + d.monthName, [W / 2, 660]);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = font(500, 44);
  ctx.fillText(d.firstName, W / 2, 330);
  ctx.fillStyle = '#fff';
  ctx.font = font(800, 92);
  ctx.fillText(fit(ctx, `הסיכום של ${d.monthName}`, W - 2 * PAD), W / 2, 440);
  const tons = d.tons.toLocaleString('he-IL');
  ctx.font = font(800, 240);
  goldText(ctx, tons, W / 2, 720, 240, theme.accent);
  ctx.fillStyle = '#fff';
  ctx.font = font(700, 54);
  ctx.fillText('טון הורמו החודש', W / 2, 810);
  const chips: [string, string][] = [
    [`${d.workouts}`, 'אימונים'],
    [`${d.prs}`, d.prs === 1 ? 'שיא חדש' : 'שיאים חדשים'],
  ];
  const cw = 360;
  const cy = 870;
  chips.forEach(([v, k], i) => {
    const x = W / 2 + (i === 0 ? 20 : -20 - cw);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    roundRect(ctx, x, cy, cw, 150, 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = i === 1 && d.prs ? theme.accent : '#fff';
    ctx.font = font(800, 76);
    ctx.fillText(v, x + cw / 2, cy + 82);
    ctx.font = font(500, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(k, x + cw / 2, cy + 128);
  });
  let y = cy + 250;
  if (d.records.length) {
    ctx.fillStyle = theme.accent;
    ctx.font = font(800, 44);
    ctx.fillText('השיאים של החודש', W / 2, y);
    y += 90;
  }
  for (const r of d.records) {
    ctx.fillStyle = hexA(theme.accent, 0.16);
    roundRect(ctx, PAD - 20, y - 62, W - 2 * PAD + 40, 88, 26);
    ctx.fill();
    const value = r.weight != null ? `${kg(r.weight)} kg × ${r.reps}` : `× ${r.reps}`;
    ctx.font = font(800, 46);
    const vw = ctx.measureText(value).width;
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.accent;
    ctx.fillText(fit(ctx, r.exercise, W - 2 * PAD - vw - 40), W - PAD, y);
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText(value, PAD, y);
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    y += 100;
  }
  if (!d.records.length && d.topExercise) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = font(500, 44);
    ctx.fillText(fit(ctx, `התרגיל של החודש: ${d.topExercise}`, W - 2 * PAD), W / 2, y);
  }
  footer(ctx, font);
  return toBlob(canvas);
}

export interface SinceStoryData {
  firstName: string;
  exercise: string;
  from: number;
  to: number;
  pct: number;
  since: string; // YYYY-MM-DD
}

/** "Since I started": the first weight against today's, in the exercise grown the most. */
export async function drawSinceStory(d: SinceStoryData): Promise<Blob> {
  const { canvas, ctx, font, theme } = await newStory('strength', d.firstName + d.exercise, [W / 2, 900]);
  const since = new Date(d.since + 'T12:00:00Z').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = font(500, 44);
  ctx.fillText(`${d.firstName} · מאז ${since}`, W / 2, 330);
  ctx.fillStyle = '#fff';
  ctx.font = font(800, 96);
  ctx.fillText('מאז שהתחלתי', W / 2, 450);
  ctx.font = font(800, 76);
  goldText(ctx, fit(ctx, d.exercise, W - 2 * PAD), W / 2, 590, 76, theme.accent);
  // Then and now, as two cards, with an arrow from the first to today (right to left).
  const cw = 380;
  const cy = 700;
  const cards: [number, string, number][] = [
    [W / 2 + 40, 'הפעם הראשונה', d.from],
    [W / 2 - 40 - cw, 'היום', d.to],
  ];
  cards.forEach(([x, label, v], i) => {
    ctx.fillStyle = i ? hexA(theme.accent, 0.2) : 'rgba(255,255,255,0.12)';
    roundRect(ctx, x, cy, cw, 300, 44);
    ctx.fill();
    ctx.strokeStyle = i ? theme.accent : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = font(500, 40);
    ctx.fillText(label, x + cw / 2, cy + 80);
    ctx.fillStyle = i ? theme.accent : '#fff';
    ctx.font = font(800, 120);
    ctx.fillText(kg(v), x + cw / 2, cy + 210);
    ctx.font = font(700, 40);
    ctx.fillText('ק״ג', x + cw / 2, cy + 265);
  });
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 24, cy + 150);
  ctx.lineTo(W / 2 + 18, cy + 120);
  ctx.lineTo(W / 2 + 18, cy + 180);
  ctx.closePath();
  ctx.fill();
  ctx.font = font(800, 230);
  ctx.direction = 'ltr';
  goldText(ctx, `+${d.pct}%`, W / 2, 1290, 230, theme.accent);
  ctx.direction = 'rtl';
  ctx.fillStyle = '#fff';
  ctx.font = font(700, 54);
  ctx.fillText('שיפור מהפעם הראשונה', W / 2, 1390);
  footer(ctx, font);
  return toBlob(canvas);
}

/** Opens the phone's share sheet (Instagram, WhatsApp...), or downloads the image where sharing files isn't possible. */
export async function shareStory(blob: Blob): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], 'workout.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
