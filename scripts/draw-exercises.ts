// Draws the exercise illustrations in src/web/public/exercises/*.svg.
// Each picture is a side-view figure in two positions: the start faint, the finish solid.
// Run: npx tsx scripts/draw-exercises.ts
import { mkdirSync, writeFileSync } from 'node:fs';

type P = [number, number];
const BRAND = '#8E568E';
const INK = '#4A2E4A';
const LINE = '#C9B4C9';
const GROUND = 186;
const L = { torso: 52, neck: 10, head: 10, thigh: 40, shin: 40, foot: 12, uarm: 28, farm: 27 };

// Angles in degrees: 0 = up, 90 = forward (right), 180 = down, 270 = back (left).
const dir = (a: number, len: number): P => [Math.sin((a * Math.PI) / 180) * len, -Math.cos((a * Math.PI) / 180) * len];
const add = (p: P, q: P): P => [p[0] + q[0], p[1] + q[1]];

interface Limb { a: number; b: number } // upper and lower segment angles
interface Pose {
  hip?: P;
  torso: number;
  head?: number; // neck angle, defaults to torso
  legN: Limb; legF?: Limb;
  armN: Limb; armF?: Limb;
  footN?: number; footF?: number; // foot angle, default 90 (flat, toes forward)
  ground?: boolean; // shift down so the lowest foot touches the floor (default true)
}
interface Joints {
  hip: P; neck: P; head: P; shoulder: P;
  kneeN: P; ankleN: P; toeN: P; kneeF: P; ankleF: P; toeF: P;
  elbowN: P; handN: P; elbowF: P; handF: P;
}

function solve(p: Pose): Joints {
  let hip: P = p.hip ?? [100, 100];
  const build = (hip: P): Joints => {
    const neck = add(hip, dir(p.torso, L.torso));
    const shoulder = add(hip, dir(p.torso, L.torso - 4));
    const head = add(neck, dir(p.head ?? p.torso, L.neck + L.head));
    const legF = p.legF ?? p.legN;
    const armF = p.armF ?? p.armN;
    const kneeN = add(hip, dir(p.legN.a, L.thigh));
    const ankleN = add(kneeN, dir(p.legN.b, L.shin));
    const kneeF = add(hip, dir(legF.a, L.thigh));
    const ankleF = add(kneeF, dir(legF.b, L.shin));
    const toeN = add(ankleN, dir(p.footN ?? 90, L.foot));
    const toeF = add(ankleF, dir(p.footF ?? p.footN ?? 90, L.foot));
    const elbowN = add(shoulder, dir(p.armN.a, L.uarm));
    const handN = add(elbowN, dir(p.armN.b, L.farm));
    const elbowF = add(shoulder, dir(armF.a, L.uarm));
    const handF = add(elbowF, dir(armF.b, L.farm));
    return { hip, neck, head, shoulder, kneeN, ankleN, toeN, kneeF, ankleF, toeF, elbowN, handN, elbowF, handF };
  };
  let j = build(hip);
  if (p.ground !== false) {
    const low = Math.max(j.ankleN[1], j.ankleF[1], j.toeN[1], j.toeF[1]);
    hip = [hip[0], hip[1] + (GROUND - 3 - low)];
    j = build(hip);
  }
  return j;
}

const f = (n: number) => Math.round(n * 10) / 10;
const line = (a: P, b: P, w: number, c: string) =>
  `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const poly = (pts: P[], w: number, c: string) =>
  `<polyline points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

type Gear = (j: Joints) => string;
const plate = (at: P) => `<circle cx="${f(at[0])}" cy="${f(at[1])}" r="17" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${f(at[0])}" cy="${f(at[1])}" r="3" fill="${INK}"/>`;
const barbellAt = (k: keyof Joints, dx = 0, dy = 0): Gear => (j) => plate(add(j[k] as P, [dx, dy]));
const backBar: Gear = (j) => plate(add(j.shoulder, dir(270, 3)));
const dumbbell = (at: P) =>
  `<rect x="${f(at[0] - 9)}" y="${f(at[1] - 5)}" width="18" height="10" rx="3" fill="${INK}"/>`;
const dbHands: Gear = (j) => dumbbell(j.handF) + dumbbell(j.handN);
const dbHandN: Gear = (j) => dumbbell(j.handN);
const kettlebell = (at: P) =>
  `<path d="M${f(at[0] - 6)} ${f(at[1] + 4)} Q${f(at[0])} ${f(at[1] - 8)} ${f(at[0] + 6)} ${f(at[1] + 4)}" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="${f(at[0])}" cy="${f(at[1] + 13)}" r="10" fill="${INK}"/>`;
const kbHands: Gear = (j) => kettlebell(j.handN);
const bench = (x: number, y: number, w: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="8" rx="3" fill="${LINE}"/><line x1="${x + 8}" y1="${y + 8}" x2="${x + 8}" y2="${GROUND}" stroke="${LINE}" stroke-width="5"/><line x1="${x + w - 8}" y1="${y + 8}" x2="${x + w - 8}" y2="${GROUND}" stroke="${LINE}" stroke-width="5"/>`;
const box = (x: number, y: number, w: number) => `<rect x="${x}" y="${y}" width="${w}" height="${GROUND - y}" rx="4" fill="${LINE}"/>`;
const pullBar = (y: number) => `<line x1="40" y1="${y}" x2="170" y2="${y}" stroke="${LINE}" stroke-width="6" stroke-linecap="round"/>`;


// Adjustable cable tower: a column with a pulley; the cable runs to the hands (faint in the start position).
const tower = (x: number, py: number) =>
  `<rect x="${f(x - 7)}" y="30" width="14" height="${GROUND - 30}" rx="4" fill="${LINE}"/><circle cx="${f(x)}" cy="${f(py)}" r="6" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
const cable = (x: number, py: number, k: keyof Joints = 'handN') => (a: Joints, b: Joints) =>
  tower(x, py) + line([x, py], a[k] as P, 2, LINE) + line([x, py], b[k] as P, 3, INK);
const handle = (at: P) => `<rect x="${f(at[0] - 5)}" y="${f(at[1] - 5)}" width="10" height="10" rx="3" fill="${INK}"/>`;
const handleN: Gear = (j) => handle(j.handN);
const ball = (at: P) => `<circle cx="${f(at[0])}" cy="${f(at[1])}" r="13" fill="${INK}"/><path d="M${f(at[0] - 13)} ${f(at[1])} H${f(at[0] + 13)}" stroke="#fff" stroke-width="2"/>`;

interface Pic { slug: string; scene?: string | ((a: Joints, b: Joints) => string); a: Pose; b: Pose; gear?: Gear; gearA?: Gear }

function figure(j: Joints, faint: boolean, gear?: Gear): string {
  const c = faint ? LINE : BRAND;
  const w = 9;
  const far = faint ? LINE : '#B892B8';
  const parts = [
    poly([j.hip, j.kneeF, j.ankleF, j.toeF], w, far),
    poly([j.shoulder, j.elbowF, j.handF], 7, far),
    gear ? gear(j) : '',
    poly([j.hip, j.neck], 11, c),
    `<circle cx="${f(j.head[0])}" cy="${f(j.head[1])}" r="${L.head + 1}" fill="${c}"/>`,
    poly([j.hip, j.kneeN, j.ankleN, j.toeN], w, c),
    poly([j.shoulder, j.elbowN, j.handN], 7, c),
  ];
  return `<g${faint ? ' opacity="0.55"' : ''}>${parts.join('')}</g>`;
}

function svg(pic: Pic): string {
  const ja = solve(pic.a);
  const jb = solve(pic.b);
  const scene = typeof pic.scene === 'function' ? pic.scene(ja, jb) : (pic.scene ?? '');
  // Fit both positions (plus room for the head, plates and props) into the frame.
  const pts = [...Object.values(ja), ...Object.values(jb)] as P[];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const box = { x0: Math.min(...xs) - 22, x1: Math.max(...xs) + 22, y0: Math.min(...ys) - 24, y1: GROUND + 2 };
  const k = Math.min(1, 168 / (box.x1 - box.x0), 160 / (box.y1 - box.y0));
  const tx = 100 - ((box.x0 + box.x1) / 2) * k;
  const ty = 184 - box.y1 * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<rect width="200" height="200" rx="24" fill="#F7F3F6"/>
<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(k * 1000) / 1000})">
<line x1="${f(box.x0 - 40)}" y1="${GROUND}" x2="${f(box.x1 + 40)}" y2="${GROUND}" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>
${scene}
${figure(ja, true, pic.gearA ?? pic.gear)}
${figure(jb, false, pic.gear)}
</g>
</svg>`;
}

const stand = (o: Partial<Pose> = {}): Pose => ({ torso: 0, legN: { a: 180, b: 180 }, armN: { a: 180, b: 180 }, ...o });
const squat = (o: Partial<Pose> = {}): Pose => ({ torso: 40, legN: { a: 100, b: 200 }, armN: { a: 180, b: 180 }, ...o });
const rack: Limb = { a: 150, b: 20 }; // hands at the shoulders, elbows down-forward
const frontRack: Limb = { a: 95, b: 300 }; // elbows high
const overhead: Limb = { a: 5, b: 0 };
const hang: Limb = { a: 180, b: 180 };

const lying = (o: Partial<Pose>): Pose => ({ hip: [130, 132], torso: 270, head: 270, legN: { a: 100, b: 180 }, armN: { a: 0, b: 0 }, ground: false, ...o });
const benchUnder = (a: Joints) => bench(a.shoulder[0] - 16, a.hip[1] + 6, a.hip[0] - a.shoulder[0] + 30);
const barAbove = (a: Joints) => pullBar(Math.min(a.handN[1], a.handF[1]) - 2);
const hangPose = (o: Partial<Pose> = {}): Pose => ({ hip: [100, 120], torso: 0, legN: { a: 182, b: 178 }, armN: { a: 2, b: 0 }, ground: false, ...o });

export const PICS: Pic[] = [
  { slug: 'back-squat', a: stand({ armN: { a: 210, b: 60 } }), b: squat({ armN: { a: 230, b: 80 } }), gear: backBar },
  { slug: 'goblet-squat', a: stand({ armN: rack }), b: squat({ torso: 20, armN: { a: 150, b: 40 } }), gear: kbHands },
  { slug: 'front-squat', a: stand({ armN: frontRack }), b: squat({ torso: 15, legN: { a: 95, b: 205 }, armN: { a: 100, b: 300 } }), gear: barbellAt('handN', 2, -4) },
  { slug: 'lunge', a: stand(), b: { torso: 0, legN: { a: 100, b: 180 }, legF: { a: 200, b: 255 }, footF: 200, armN: hang }, gear: dbHands },
  { slug: 'bulgarian-split-squat', scene: (a, b) => bench(b.ankleF[0] - 30, b.ankleF[1] - 4, 40), a: { torso: 5, legN: { a: 165, b: 180 }, legF: { a: 205, b: 290 }, footF: 280, armN: hang }, b: { torso: 10, legN: { a: 100, b: 180 }, legF: { a: 185, b: 275 }, footF: 280, armN: hang }, gear: dbHands },
  { slug: 'deadlift', a: { torso: 60, legN: { a: 135, b: 190 }, armN: hang }, b: stand(), gear: barbellAt('handN', 0, 6) },
  { slug: 'romanian-deadlift', a: stand(), b: { torso: 80, legN: { a: 170, b: 185 }, armN: hang }, gear: barbellAt('handN', 0, 6) },
  { slug: 'hip-thrust', scene: (a) => bench(a.shoulder[0] - 30, a.shoulder[1] + 4, 40), a: { torso: 290, head: 300, legN: { a: 55, b: 175 }, armN: { a: 250, b: 200 } }, b: { torso: 270, head: 290, legN: { a: 85, b: 180 }, armN: { a: 250, b: 200 } }, gear: barbellAt('hip', 0, -14) },
  { slug: 'glute-bridge', a: { hip: [120, 176], torso: 270, head: 275, legN: { a: 70, b: 165 }, armN: { a: 120, b: 90 }, ground: false }, b: { hip: [120, 156], torso: 248, head: 262, legN: { a: 100, b: 170 }, armN: { a: 130, b: 90 }, ground: false } },
  { slug: 'cable-kickback', scene: (a) => `<rect x="${f(a.handN[0] + 4)}" y="40" width="12" height="${GROUND - 40}" rx="3" fill="${LINE}"/>`, a: { torso: 60, legN: { a: 160, b: 180 }, legF: { a: 175, b: 180 }, armN: { a: 120, b: 120 } }, b: { torso: 60, legN: { a: 160, b: 180 }, legF: { a: 255, b: 250 }, footF: 180, armN: { a: 120, b: 120 } } },
  { slug: 'bench-press', scene: benchUnder, a: lying({ armN: { a: 0, b: 0 } }), b: lying({ armN: { a: 175, b: 5 } }), gear: barbellAt('handN') },
  { slug: 'dumbbell-bench-press', scene: benchUnder, a: lying({ armN: { a: 0, b: 0 } }), b: lying({ armN: { a: 175, b: 5 } }), gear: dbHandN },
  { slug: 'skull-crusher', scene: benchUnder, a: lying({ armN: { a: 345, b: 345 } }), b: lying({ armN: { a: 345, b: 245 } }), gear: dbHandN },
  { slug: 'push-up', a: { hip: [90, 140], torso: 74, head: 78, legN: { a: 254, b: 254 }, footN: 180, armN: { a: 180, b: 180 }, ground: false }, b: { hip: [90, 160], torso: 84, head: 84, legN: { a: 262, b: 262 }, footN: 180, armN: { a: 225, b: 150 }, ground: false } },
  { slug: 'plank', a: { hip: [96, 152], torso: 80, head: 82, legN: { a: 258, b: 258 }, footN: 180, armN: { a: 180, b: 90 }, ground: false }, b: { hip: [96, 152], torso: 80, head: 82, legN: { a: 258, b: 258 }, footN: 180, armN: { a: 180, b: 90 }, ground: false } },
  { slug: 'bent-over-row', a: { torso: 70, legN: { a: 160, b: 185 }, armN: hang }, b: { torso: 70, legN: { a: 160, b: 185 }, armN: { a: 230, b: 150 } }, gear: barbellAt('handN', 0, 6) },
  { slug: 'dumbbell-row', scene: (a) => bench(a.handF[0] - 24, a.handF[1] + 2, 60), a: { torso: 80, legN: { a: 175, b: 180 }, legF: { a: 130, b: 180 }, armN: hang, armF: { a: 175, b: 175 } }, b: { torso: 80, legN: { a: 175, b: 180 }, legF: { a: 130, b: 180 }, armN: { a: 240, b: 150 }, armF: { a: 175, b: 175 } }, gear: dbHandN },
  { slug: 'ring-row', scene: (a, b) => line([a.handN[0], 10], a.handN, 3, LINE) + `<circle cx="${f(a.handN[0])}" cy="${f(a.handN[1])}" r="6" fill="none" stroke="${INK}" stroke-width="3"/>`, a: { hip: [90, 150], torso: 55, head: 55, legN: { a: 235, b: 235 }, footN: 150, armN: { a: 55, b: 55 }, ground: false }, b: { hip: [96, 138], torso: 50, head: 50, legN: { a: 230, b: 230 }, footN: 150, armN: { a: 150, b: 20 }, ground: false } },
  { slug: 'pull-up', scene: barAbove, a: hangPose(), b: hangPose({ hip: [100, 66], armN: { a: 150, b: 18 } }) },
  { slug: 'weighted-pull-up', scene: barAbove, a: hangPose(), b: hangPose({ hip: [100, 66], armN: { a: 150, b: 18 } }), gear: (j) => kettlebell(add(j.hip, [0, 8])) },
  { slug: 'toes-to-bar', scene: barAbove, a: hangPose(), b: hangPose({ torso: 345, legN: { a: 35, b: 15 }, footN: 0, armN: { a: 15, b: 10 } }) },
  { slug: 'lat-pulldown', scene: (a) => `<rect x="${f(a.handN[0] - 30)}" y="${f(a.handN[1] - 22)}" width="60" height="6" rx="3" fill="${LINE}"/>` + bench(a.hip[0] - 24, a.hip[1] + 6, 40), a: { torso: 350, legN: { a: 90, b: 180 }, armN: { a: 10, b: 0 } }, b: { torso: 350, legN: { a: 90, b: 180 }, armN: { a: 150, b: 20 } } },
  { slug: 'overhead-press', a: stand({ armN: rack }), b: stand({ armN: overhead }), gear: barbellAt('handN', 0, -2) },
  { slug: 'push-press', a: { torso: 0, legN: { a: 150, b: 205 }, armN: rack }, b: stand({ armN: overhead }), gear: barbellAt('handN', 0, -2) },
  { slug: 'dumbbell-shoulder-press', a: stand({ armN: { a: 120, b: 10 } }), b: stand({ armN: overhead }), gear: dbHands },
  { slug: 'lateral-raise', a: stand({ armN: { a: 175, b: 175 } }), b: stand({ armN: { a: 95, b: 100 } }), gear: dbHandN },
  { slug: 'biceps-curl', a: stand({ armN: { a: 180, b: 180 } }), b: stand({ armN: { a: 180, b: 30 } }), gear: dbHandN },
  { slug: 'triceps-extension', a: stand({ armN: { a: 10, b: 200 } }), b: stand({ armN: overhead }), gear: dbHandN },
  { slug: 'dips', scene: (a) => line([a.handN[0] - 40, a.handN[1] + 2], [a.handN[0] + 30, a.handN[1] + 2], 6, LINE) + line([a.handN[0] + 20, a.handN[1] + 2], [a.handN[0] + 20, GROUND], 5, LINE), a: { hip: [100, 120], torso: 5, legN: { a: 200, b: 170 }, armN: { a: 180, b: 180 }, ground: false }, b: { hip: [100, 140], torso: 10, legN: { a: 210, b: 170 }, armN: { a: 225, b: 120 }, ground: false } },
  { slug: 'kettlebell-swing', a: { torso: 70, legN: { a: 155, b: 190 }, armN: { a: 200, b: 200 } }, b: stand({ armN: { a: 90, b: 90 } }), gear: kbHands },
  { slug: 'thruster', a: squat({ torso: 15, legN: { a: 95, b: 205 }, armN: frontRack }), b: stand({ armN: overhead }), gear: barbellAt('handN', 0, -2) },
  { slug: 'box-jump', scene: (a, b) => box(b.ankleN[0] - 30, b.ankleN[1] + 3, 56), a: { torso: 45, legN: { a: 120, b: 200 }, armN: { a: 240, b: 240 } }, b: { hip: [150, 66], torso: 0, legN: { a: 180, b: 180 }, armN: { a: 160, b: 170 }, ground: false } },
  { slug: 'russian-twist', a: { hip: [96, 176], torso: 330, head: 340, legN: { a: 70, b: 150 }, armN: { a: 120, b: 60 }, ground: false }, b: { hip: [96, 176], torso: 330, head: 340, legN: { a: 70, b: 150 }, armN: { a: 160, b: 120 }, ground: false }, gear: dbHandN },
  // Cable (adjustable pulley), boxes and wall balls (ofir, 2026-11-12).
  { slug: 'seated-cable-row', scene: cable(178, 150), a: { hip: [90, 168], torso: 10, legN: { a: 88, b: 95 }, footN: 10, armN: { a: 95, b: 92 }, ground: false }, b: { hip: [90, 168], torso: 352, legN: { a: 88, b: 95 }, footN: 10, armN: { a: 200, b: 85 }, ground: false }, gear: handleN },
  { slug: 'face-pull', scene: cable(175, 62), a: stand({ armN: { a: 70, b: 72 } }), b: stand({ armN: { a: 275, b: 25 } }), gear: handleN },
  { slug: 'triceps-pushdown', scene: cable(150, 38), a: stand({ torso: 8, armN: { a: 172, b: 25 } }), b: stand({ torso: 8, armN: { a: 172, b: 172 } }), gear: handleN },
  { slug: 'overhead-cable-triceps', scene: cable(40, 72), a: { torso: 35, legN: { a: 160, b: 185 }, legF: { a: 205, b: 185 }, armN: { a: 15, b: 200 } }, b: { torso: 35, legN: { a: 160, b: 185 }, legF: { a: 205, b: 185 }, armN: { a: 25, b: 28 } }, gear: handleN },
  { slug: 'cable-curl', scene: cable(150, 176), a: stand({ armN: { a: 182, b: 175 } }), b: stand({ armN: { a: 182, b: 25 } }), gear: handleN },
  { slug: 'cable-fly', scene: cable(48, 52), a: stand({ armN: { a: 240, b: 235 } }), b: stand({ armN: { a: 95, b: 92 } }), gear: handleN },
  { slug: 'cable-lateral-raise', scene: cable(70, 176), a: stand({ armN: { a: 175, b: 175 } }), b: stand({ armN: { a: 95, b: 100 } }), gear: handleN },
  { slug: 'pallof-press', scene: cable(178, 92), a: { torso: 0, legN: { a: 165, b: 190 }, legF: { a: 195, b: 175 }, armN: { a: 150, b: 20 } }, b: { torso: 0, legN: { a: 165, b: 190 }, legF: { a: 195, b: 175 }, armN: { a: 90, b: 90 } }, gear: handleN },
  { slug: 'cable-woodchop', scene: cable(40, 40), a: { torso: 350, legN: { a: 165, b: 185 }, legF: { a: 195, b: 180 }, armN: { a: 330, b: 330 } }, b: { torso: 25, legN: { a: 150, b: 200 }, legF: { a: 200, b: 175 }, armN: { a: 145, b: 145 } }, gear: handleN },
  { slug: 'cable-pull-through', scene: cable(30, 172), a: { torso: 75, legN: { a: 160, b: 190 }, armN: { a: 195, b: 195 } }, b: stand({ armN: { a: 180, b: 182 } }), gear: handleN },
  { slug: 'straight-arm-pulldown', scene: cable(165, 40), a: stand({ torso: 20, armN: { a: 40, b: 40 } }), b: stand({ torso: 20, armN: { a: 170, b: 170 } }), gear: handleN },
  { slug: 'cable-crunch', scene: cable(178, 40), a: { hip: [96, 143], torso: 15, head: 20, legN: { a: 180, b: 270 }, footN: 270, armN: { a: 35, b: 215 }, ground: false }, b: { hip: [96, 143], torso: 75, head: 95, legN: { a: 180, b: 270 }, footN: 270, armN: { a: 115, b: 280 }, ground: false } },
  { slug: 'step-up', scene: (a) => box(a.ankleN[0] - 20, a.ankleN[1] + 3, 56), a: { torso: 10, legN: { a: 110, b: 185 }, legF: { a: 185, b: 180 }, armN: hang }, b: { hip: [132, 77], torso: 0, legN: { a: 180, b: 180 }, legF: { a: 178, b: 182 }, armN: hang, ground: false }, gear: dbHands },
  { slug: 'box-squat', scene: (a, b) => box(b.hip[0] - 34, b.hip[1] + 9, 34), a: stand({ armN: { a: 210, b: 60 } }), b: squat({ legN: { a: 92, b: 195 }, armN: { a: 230, b: 80 } }), gear: backBar },
  { slug: 'bench-dips', scene: (a) => box(a.handN[0] - 32, a.handN[1] + 3, 40), a: { hip: [100, 128], torso: 0, legN: { a: 135, b: 135 }, armN: { a: 185, b: 185 }, ground: false }, b: { hip: [100, 150], torso: 0, legN: { a: 100, b: 135 }, armN: { a: 250, b: 138 }, ground: false } },
  { slug: 'wall-ball', scene: (a, b) => `<rect x="${f(b.handN[0] + 34)}" y="10" width="8" height="${GROUND - 10}" fill="${LINE}"/><rect x="${f(b.handN[0] + 24)}" y="20" width="10" height="14" rx="2" fill="${BRAND}"/>`, a: squat({ torso: 15, legN: { a: 95, b: 205 }, armN: { a: 150, b: 20 } }), b: stand({ armN: { a: 15, b: 10 } }), gear: (j) => ball(add(j.handN, [4, -10])) },

  // More pulley and free-weight exercises (ofir, 2026-11-12).
  { slug: 'cable-reverse-fly', scene: cable(178, 66), a: stand({ armN: { a: 95, b: 95 } }), b: stand({ armN: { a: 262, b: 262 } }), gear: handleN },
  { slug: 'single-arm-cable-row', scene: cable(178, 100), a: { torso: 15, legN: { a: 160, b: 190 }, legF: { a: 200, b: 180 }, armN: { a: 75, b: 78 } }, b: { torso: 10, legN: { a: 160, b: 190 }, legF: { a: 200, b: 180 }, armN: { a: 205, b: 92 } }, gear: handleN },
  { slug: 'cable-chest-press', scene: cable(28, 78), a: { torso: 10, legN: { a: 160, b: 190 }, legF: { a: 205, b: 180 }, armN: { a: 230, b: 110 } }, b: { torso: 10, legN: { a: 160, b: 190 }, legF: { a: 205, b: 180 }, armN: { a: 95, b: 92 } }, gear: handleN },
  { slug: 'cable-front-raise', scene: cable(36, 178), a: stand({ armN: { a: 178, b: 176 } }), b: stand({ armN: { a: 92, b: 90 } }), gear: handleN },
  { slug: 'cable-hammer-curl', scene: cable(150, 176), a: stand({ armN: { a: 182, b: 175 } }), b: stand({ armN: { a: 182, b: 30 } }), gear: (j) => line(j.handN, add(j.handN, [0, 12]), 4, INK) + handle(add(j.handN, [0, 14])) },
  { slug: 'cable-hip-abduction', scene: cable(30, 178, 'ankleF'), a: stand({ legF: { a: 184, b: 182 }, armN: { a: 160, b: 160 } }), b: stand({ legF: { a: 140, b: 140 }, footF: 120, armN: { a: 160, b: 160 } }) },
  { slug: 'sumo-deadlift', a: { torso: 45, legN: { a: 118, b: 182 }, armN: hang }, b: stand(), gear: barbellAt('handN', 0, 6) },
  { slug: 'power-clean', a: { torso: 60, legN: { a: 135, b: 190 }, armN: hang }, b: { torso: 5, legN: { a: 155, b: 205 }, armN: frontRack }, gearA: barbellAt('handN', 0, 6), gear: (j) => plate(add(j.shoulder, [18, 4])) },
  { slug: 'squat-clean', a: { torso: 60, legN: { a: 135, b: 190 }, armN: hang }, b: squat({ torso: 15, legN: { a: 95, b: 205 }, armN: frontRack }), gearA: barbellAt('handN', 0, 6), gear: (j) => plate(add(j.shoulder, [18, 4])) },
  { slug: 'power-snatch', a: { torso: 60, legN: { a: 135, b: 190 }, armN: { a: 195, b: 195 } }, b: { torso: 5, legN: { a: 155, b: 205 }, armN: { a: 352, b: 352 } }, gearA: barbellAt('handN', 0, 6), gear: barbellAt('handN', 0, -2) },
  { slug: 'push-jerk', a: stand({ armN: rack }), b: { torso: 2, legN: { a: 158, b: 202 }, armN: { a: 2, b: 0 } }, gear: barbellAt('handN', 0, -2) },
  { slug: 'arnold-press', a: stand({ armN: { a: 140, b: 5 } }), b: stand({ armN: overhead }), gear: dbHands },
  { slug: 'hammer-curl', a: stand({ armN: { a: 180, b: 180 } }), b: stand({ armN: { a: 180, b: 35 } }), gear: (j) => `<rect x="${f(j.handN[0] - 5)}" y="${f(j.handN[1] - 9)}" width="10" height="18" rx="3" fill="${INK}"/>` },
  { slug: 'single-leg-rdl', a: stand(), b: { torso: 88, head: 80, legN: { a: 175, b: 182 }, legF: { a: 272, b: 272 }, footF: 180, armN: hang }, gear: dbHandN },
  { slug: 'incline-dumbbell-press', scene: (a) => line(add(a.hip, [14, 8]), add(add(a.hip, [14, 8]), dir(320, 74)), 9, LINE) + line(add(a.hip, [10, 10]), [a.hip[0] + 10, GROUND], 5, LINE), a: { hip: [118, 150], torso: 320, head: 320, legN: { a: 100, b: 180 }, armN: { a: 220, b: 50 }, ground: false }, b: { hip: [118, 150], torso: 320, head: 320, legN: { a: 100, b: 180 }, armN: { a: 50, b: 50 }, ground: false }, gear: dbHandN },
  { slug: 'dumbbell-pullover', scene: benchUnder, a: lying({ armN: { a: 268, b: 268 } }), b: lying({ armN: { a: 0, b: 0 } }), gear: dbHandN },
  { slug: 'renegade-row', a: { hip: [90, 140], torso: 74, head: 78, legN: { a: 254, b: 254 }, footN: 180, armN: { a: 180, b: 180 }, ground: false }, b: { hip: [90, 140], torso: 74, head: 78, legN: { a: 254, b: 254 }, footN: 180, armN: { a: 345, b: 195 }, armF: { a: 180, b: 180 }, ground: false }, gear: (j) => dumbbell(j.handN) + dumbbell(add(j.handF, [0, 4])) },
  { slug: 'farmers-carry', a: { torso: 0, legN: { a: 160, b: 185 }, legF: { a: 200, b: 195 }, armN: hang }, b: { torso: 0, legN: { a: 200, b: 195 }, legF: { a: 160, b: 185 }, armN: hang }, gear: dbHands },
  { slug: 'turkish-get-up', a: lying({ hip: [120, 176], legN: { a: 60, b: 150 }, armN: { a: 0, b: 0 } }), b: stand({ armN: { a: 0, b: 0 } }), gear: (j) => kettlebell(add(j.handN, [0, -22])) },
  { slug: 'kettlebell-snatch', a: { torso: 65, legN: { a: 150, b: 190 }, armN: { a: 195, b: 195 } }, b: stand({ armN: { a: 2, b: 0 } }), gearA: kbHands, gear: (j) => kettlebell(add(j.handN, [6, -8])) },
  { slug: 'good-morning', a: stand({ armN: { a: 210, b: 60 } }), b: { torso: 80, legN: { a: 168, b: 186 }, armN: { a: 290, b: 140 } }, gear: backBar },
  { slug: 'cable-leg-extension', scene: (a, b) => cable(28, 176, 'ankleN')(a, b) + bench(a.hip[0] - 34, a.hip[1] + 6, 46), a: { hip: [100, 130], torso: 0, legN: { a: 90, b: 180 }, armN: { a: 175, b: 150 }, ground: false }, b: { hip: [100, 130], torso: 0, legN: { a: 90, b: 92 }, armN: { a: 175, b: 150 }, ground: false } },
  { slug: 'lying-cable-leg-curl', scene: (a, b) => cable(185, 168, 'ankleN')(a, b) + bench(a.head[0] - 6, a.hip[1] + 8, a.kneeN[0] - a.head[0] + 6), a: { hip: [100, 150], torso: 270, head: 270, legN: { a: 90, b: 90 }, footN: 180, armN: { a: 250, b: 175 }, ground: false }, b: { hip: [100, 150], torso: 270, head: 270, legN: { a: 90, b: 15 }, footN: 300, armN: { a: 250, b: 175 }, ground: false } },

  // Exercises coaches added that were waiting for a drawing (ofir, 2026-11-16).
  { slug: 'barbell-lunge', a: stand({ armN: { a: 210, b: 60 } }), b: { torso: 0, legN: { a: 100, b: 180 }, legF: { a: 200, b: 255 }, footF: 200, armN: { a: 230, b: 80 } }, gear: backBar },
  { slug: 'incline-reverse-fly', scene: (a) => line(add(a.hip, [14, 4]), add(add(a.hip, [14, 4]), dir(48, 56)), 9, LINE) + line(add(a.hip, [22, 0]), [a.hip[0] + 22, GROUND], 5, LINE), a: { hip: [100, 140], torso: 48, head: 60, legN: { a: 190, b: 185 }, legF: { a: 205, b: 185 }, armN: { a: 182, b: 182 } }, b: { hip: [100, 140], torso: 48, head: 60, legN: { a: 190, b: 185 }, legF: { a: 205, b: 185 }, armN: { a: 245, b: 245 } }, gear: dbHandN },
  { slug: 'plank-drag', a: { hip: [90, 140], torso: 74, head: 78, legN: { a: 254, b: 254 }, footN: 180, armN: { a: 180, b: 180 }, ground: false }, b: { hip: [90, 140], torso: 74, head: 78, legN: { a: 254, b: 254 }, footN: 180, armN: { a: 208, b: 205 }, armF: { a: 180, b: 180 }, ground: false }, gearA: (j) => dumbbell(add(j.handN, [-22, 8])), gear: (j) => dumbbell(add(j.handN, [0, 4])) },
  { slug: 'trx-hip-lift', scene: (a, b) => line([a.ankleN[0] + 6, 10], b.ankleN, 3, INK) + line([a.ankleN[0] + 6, 10], a.ankleN, 2, LINE) + `<circle cx="${f(a.ankleN[0] + 6)}" cy="10" r="4" fill="${INK}"/>`, a: { hip: [80, 176], torso: 270, head: 275, legN: { a: 60, b: 75 }, footN: 0, armN: { a: 110, b: 95 }, ground: false }, b: { hip: [80, 148], torso: 252, head: 262, legN: { a: 62, b: 62 }, footN: 0, armN: { a: 120, b: 95 }, ground: false } },
  { slug: 'trx-pistol-squat', scene: (a, b) => line([186, 12], b.handN, 3, INK) + line([186, 12], a.handN, 2, LINE) + `<circle cx="186" cy="12" r="4" fill="${INK}"/>`, a: { torso: 0, legN: { a: 180, b: 180 }, legF: { a: 150, b: 175 }, armN: { a: 120, b: 95 } }, b: { torso: 30, legN: { a: 100, b: 205 }, legF: { a: 92, b: 90 }, footF: 30, armN: { a: 75, b: 75 } }, gear: handleN },
  { slug: 'hang-clean', a: { torso: 25, legN: { a: 165, b: 190 }, armN: hang }, b: { torso: 5, legN: { a: 155, b: 205 }, armN: frontRack }, gearA: barbellAt('handN', 0, 6), gear: (j) => plate(add(j.shoulder, [18, 4])) },
  { slug: 'band-hip-abduction', scene: (a, b) => line(b.ankleN, b.ankleF, 5, BRAND) + line(a.ankleN, a.ankleF, 4, LINE), a: stand({ legF: { a: 184, b: 182 }, armN: { a: 160, b: 160 } }), b: stand({ torso: 352, legN: { a: 182, b: 180 }, legF: { a: 145, b: 145 }, footF: 120, armN: { a: 160, b: 160 } }) },
  { slug: 'lateral-lunge', a: stand({ armN: { a: 160, b: 120 } }), b: { torso: 25, head: 15, legN: { a: 128, b: 195 }, legF: { a: 232, b: 232 }, footF: 200, armN: { a: 150, b: 95 } } },
  { slug: 'band-side-kick', scene: (a, b) => line(b.ankleN, b.ankleF, 5, BRAND) + line(a.ankleN, a.ankleF, 4, LINE), a: stand({ armN: { a: 150, b: 40 } }), b: { torso: 340, head: 350, legN: { a: 108, b: 105 }, footN: 60, legF: { a: 182, b: 180 }, armN: { a: 150, b: 40 } } },
  // Exercises coaches added that were waiting for a drawing (ofir, 2026-11-18).
  { slug: 'scorpion', scene: (a, b) => line(b.kneeN, b.kneeF, 5, BRAND) + line(a.kneeN, a.kneeF, 4, LINE), a: { torso: 25, legN: { a: 150, b: 195 }, legF: { a: 165, b: 190 }, armN: { a: 140, b: 60 } }, b: { torso: 30, legN: { a: 150, b: 195 }, legF: { a: 215, b: 200 }, footF: 150, armN: { a: 140, b: 60 } } },
  { slug: 'hanging-knee-hold', scene: barAbove, a: hangPose(), b: hangPose({ legN: { a: 92, b: 180 } }) },
  { slug: 'hanging-knee-raise', scene: barAbove, a: hangPose(), b: hangPose({ torso: 352, legN: { a: 50, b: 165 }, armN: { a: 8, b: 2 } }) },
  { slug: 'weighted-reverse-crunch', a: { hip: [110, 176], torso: 270, head: 274, legN: { a: 0, b: 90 }, footN: 90, armN: { a: 90, b: 90 }, ground: false }, b: { hip: [110, 166], torso: 258, head: 270, legN: { a: 335, b: 75 }, footN: 75, armN: { a: 95, b: 95 }, ground: false }, gear: (j) => dumbbell(add(j.kneeN, [0, 0])) },
  { slug: 'single-leg-hip-thrust', scene: (a) => bench(a.shoulder[0] - 30, a.shoulder[1] + 4, 40), a: { torso: 290, head: 300, legN: { a: 55, b: 175 }, legF: { a: 40, b: 40 }, footF: 30, armN: { a: 250, b: 200 } }, b: { torso: 270, head: 290, legN: { a: 85, b: 180 }, legF: { a: 88, b: 88 }, footF: 0, armN: { a: 250, b: 200 } } },
  { slug: 'squat-upright-row', a: squat({ torso: 30, armN: { a: 175, b: 175 } }), b: stand({ armN: { a: 65, b: 235 } }), gear: dbHandN },
  // More exercises coaches added, redrawn over a stand-in picture (ofir, 2026-11-18).
  { slug: 'chin-up', scene: barAbove, a: hangPose(), b: hangPose({ hip: [100, 66], armN: { a: 160, b: 12 } }) },
  { slug: 'eccentric-pull-up', scene: barAbove, a: hangPose({ hip: [100, 66], armN: { a: 150, b: 18 } }), b: hangPose() },
  { slug: 'jump-squat', a: squat({ torso: 20, armN: { a: 120, b: 30 } }), b: { hip: [100, 78], torso: 0, legN: { a: 178, b: 182 }, footN: 150, armN: { a: 200, b: 200 }, ground: false } },
  { slug: 'sumo-squat', a: stand({ legN: { a: 172, b: 180 }, legF: { a: 188, b: 180 }, armN: hang }), b: squat({ torso: 12, legN: { a: 108, b: 188 }, legF: { a: 108, b: 188 }, armN: { a: 175, b: 175 } }), gear: kbHands },
  { slug: 'heel-elevated-goblet-squat', scene: (a, b) => `<path d="M${f(b.ankleN[0] - 14)} ${GROUND} L${f(b.ankleN[0] + 18)} ${GROUND} L${f(b.ankleN[0] - 14)} ${GROUND - 12} Z" fill="${BRAND}" opacity="0.6"/>`, a: stand({ armN: rack, footN: 105 }), b: squat({ torso: 12, legN: { a: 100, b: 215 }, armN: { a: 150, b: 40 }, footN: 105 }), gear: kbHands },
  { slug: 'high-cable-row', scene: cable(178, 40), a: { torso: 5, legN: { a: 165, b: 185 }, legF: { a: 198, b: 180 }, armN: { a: 45, b: 45 } }, b: { torso: 0, legN: { a: 165, b: 185 }, legF: { a: 198, b: 180 }, armN: { a: 205, b: 70 } }, gear: handleN },
  { slug: 'bosu-crunch', scene: (a) => `<path d="M${f(a.hip[0] - 46)} ${GROUND} A 28 34 0 0 1 ${f(a.hip[0] + 10)} ${GROUND} Z" fill="${LINE}"/>`, a: { hip: [110, 152], torso: 262, head: 258, legN: { a: 80, b: 160 }, armN: { a: 300, b: 90 }, ground: false }, b: { hip: [110, 152], torso: 300, head: 315, legN: { a: 80, b: 160 }, armN: { a: 340, b: 120 }, ground: false } },
  { slug: 'side-crunch', a: { hip: [110, 176], torso: 270, head: 272, legN: { a: 55, b: 160 }, armN: { a: 90, b: 90 }, ground: false }, b: { hip: [110, 176], torso: 312, head: 330, legN: { a: 55, b: 160 }, armN: { a: 75, b: 70 }, ground: false } },
  // Exercises coaches added that were waiting for a drawing (ofir, 2026-11-20).
  // Side bend is the one front view: legs apart, leaning sideways toward the dumbbell.
  { slug: 'side-bend', a: { torso: 0, legN: { a: 165, b: 180 }, legF: { a: 195, b: 180 }, footN: 120, footF: 240, armN: { a: 172, b: 178 }, armF: { a: 200, b: 160 } }, b: { torso: 20, head: 16, legN: { a: 165, b: 180 }, legF: { a: 195, b: 180 }, footN: 120, footF: 240, armN: { a: 178, b: 180 }, armF: { a: 215, b: 150 } }, gear: dbHandN },
  { slug: 'suitcase-carry', a: { torso: 0, legN: { a: 160, b: 185 }, legF: { a: 200, b: 195 }, armN: hang, armF: { a: 175, b: 160 } }, b: { torso: 0, legN: { a: 200, b: 195 }, legF: { a: 160, b: 185 }, armN: hang, armF: { a: 185, b: 160 } }, gear: dbHandN },
  { slug: 'dumbbell-front-raise', a: stand({ armN: { a: 178, b: 176 } }), b: stand({ armN: { a: 92, b: 90 } }), gear: dbHandN },
  { slug: 'front-foot-elevated-lunge', scene: (a, b) => box(b.ankleN[0] - 18, b.ankleN[1] + 3, 44), a: { hip: [134, 90], torso: 0, legN: hang, armN: hang, ground: false }, b: { torso: 0, legN: { a: 100, b: 178 }, legF: { a: 200, b: 255 }, footF: 200, armN: hang }, gear: dbHands },
  { slug: 'rear-foot-elevated-rdl', scene: (a, b) => bench(b.ankleF[0] - 30, b.ankleF[1] - 4, 40), a: { torso: 5, legN: { a: 172, b: 182 }, legF: { a: 205, b: 290 }, footF: 280, armN: hang }, b: { torso: 75, legN: { a: 160, b: 188 }, legF: { a: 206, b: 294 }, footF: 285, armN: hang }, gear: dbHandN },
  { slug: 'dumbbell-shoulder-squat', a: stand({ armN: { a: 165, b: 355 } }), b: squat({ torso: 30, armN: { a: 175, b: 45 } }), gear: (j) => dumbbell(add(j.handN, [-2, -5])) },
  { slug: 'single-arm-cable-pushdown', scene: cable(150, 38), a: { torso: 8, legN: { a: 170, b: 182 }, legF: { a: 192, b: 180 }, armN: { a: 172, b: 25 }, armF: { a: 205, b: 110 } }, b: { torso: 8, legN: { a: 170, b: 182 }, legF: { a: 192, b: 180 }, armN: { a: 172, b: 172 }, armF: { a: 205, b: 110 } }, gear: handleN },
];

const out = new URL('../src/web/public/exercises/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const p of PICS) writeFileSync(new URL(`${p.slug}.svg`, out), svg(p));

// A placeholder for each body area: a front-view figure with the worked area in the brand colour. A new exercise
// with no truly similar drawing gets one of these until a proper drawing is made for it.
export const AREAS = ['legs', 'glutes', 'back', 'chest', 'shoulders', 'arms', 'core'] as const;
function generic(area: (typeof AREAS)[number]): string {
  const c = (on: boolean) => (on ? BRAND : LINE);
  const limb = (pts: P[], on: boolean) => poly(pts, 12, c(on));
  const legs = area === 'legs';
  const arms = area === 'arms';
  const upper = area === 'chest' || area === 'back';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<rect width="200" height="200" rx="24" fill="#F7F3F6"/>
<line x1="50" y1="${GROUND - 4}" x2="150" y2="${GROUND - 4}" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>
${limb([[90, 132], [87, 156], [85, 180]], legs)}${limb([[110, 132], [113, 156], [115, 180]], legs)}
${limb([[74, 60], [66, 94], [62, 124]], arms)}${limb([[126, 60], [134, 94], [138, 124]], arms)}
<rect x="80" y="52" width="40" height="38" rx="10" fill="${c(upper)}"/>
<rect x="82" y="92" width="36" height="24" rx="8" fill="${c(area === 'core')}"/>
<rect x="82" y="118" width="36" height="18" rx="8" fill="${c(area === 'glutes')}"/>
<circle cx="76" cy="58" r="10" fill="${c(area === 'shoulders')}"/><circle cx="124" cy="58" r="10" fill="${c(area === 'shoulders')}"/>
<circle cx="100" cy="32" r="14" fill="${LINE}"/>
</svg>`;
}
for (const a of AREAS) writeFileSync(new URL(`generic-${a}.svg`, out), generic(a));
console.log(`drew ${PICS.length} pictures and ${AREAS.length} placeholders`);
