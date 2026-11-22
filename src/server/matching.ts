// Turns a free-text workout into exercises, and matches
// exercise names against the library and learned aliases.

export interface WorkoutSection {
  title: string; // "Strength", "Metcon", "חימום"...
  format?: string | null; // "AMRAP 10MIN", "RFT 3", "FOR TIME"
  text: string;
}

export interface ParsedLine {
  lineNo: number;
  raw: string;
  name: string;
  sets: number | null;
  reps: number | null; // lower bound when a range is given, the total for clusters like 2+1+1
  repsText: string | null; // as prescribed: "10", "8–10", "2+1+1"
  section: string | null;
}

const FINAL_LETTERS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/**
 * Normalizes a name so small differences don't matter: case, spaces, hyphens, quotes, niqqud,
 * Hebrew final letters, and English plurals ("Toes-to-Bars" = "toes to bar").
 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c])
    .toLowerCase()
    .replace(/[-–_'"`׳״.,:;()\[\]\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (/^[a-z]{3,}s$/.test(w) && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

// Sections where weights are not logged. The list is a default and lives in settings.
export const DEFAULT_SKIP_SECTIONS = ['warm up', 'warmup', 'metcon', 'wod', 'cool down', 'cooldown', 'mobility', 'conditioning', 'finisher', 'חימום', 'שחרור', 'מטקון'];
const KNOWN_SECTIONS = [
  ...DEFAULT_SKIP_SECTIONS,
  ...['strength', 'skill', 'accessory', 'accessorie', 'weightlifting', 'power'],
  ...['כוח', 'כח', 'טכניקה', 'סקיל', 'עזר', 'אביזרים', 'הרמת משקולות', 'מוביליטי', 'גמישות'],
];
// Compared after normalizeName (Hebrew final letters folded), so normalize the list the same way.
let knownSectionsNorm: string[] | null = null;
const knownSections = () => (knownSectionsNorm ??= KNOWN_SECTIONS.map(normalizeName));
const FORMAT_RE = /^(?:(amrap|emom|e\d+mom|for[ _]time|rft|\d+\s*rft|tabata|every|\d+\s*rounds?)\b|\d+\s*סבבים|סבבים|לזמן|כל\s+\d+\s*דק)/i;
// Instruction lines, not exercises: rest, RIR, totals, goals, load cues, "Attempt 2 – Increase load × 3 reps".
const NOTE_RE =
  /^(rir|rpe|rest|tempo|total|goal|goals|note|notes|time cap|cap|scale|scaling|scaled|rx|then|if|focus|cue|cues|keep|make sure|remember|try|today|score|intensity|pace|optional|stimulus|intent|purpose|objective|description|coach|coaches|athletes?|beginners?|intermediate|advanced|level|levels|option|options|why|tip|tips)\b|\b(between|load|increase|technique|appropriate)\b|[@/]|^(מנוחה|הערה|הערות|דגש|דגשים|טמפו|קצב|יעד|מטרה|סה["״']?כ|סך הכל|אם|אחר כך|לבחור|להעלות|עלייה|ירידה|שימו לב|לשים לב|חשוב|היום|להקפיד|מקפידים|לנסות|זכרו|טיפ|מתחילים|מתקדמים|רמה|אפשרות|אופציה)(?=[\s:,.]|$)|(^|\s)(בין|משקל מתאים|עד כשל)(?=\s|$)/i;
// Words that only describe the reps: "6 חזרות", "6 לכל רגל", "8 each side", "10-12 each direction".
const REP_WORDS = /\b(reps?|each(\s+(side|leg|arm|direction|way))?|per\s+(side|leg|arm|direction))\b|חזרות|חז['׳]|לכל\s+(רגל|יד|צד|כיוון)|לצד/gi;
// Numbered blocks that only split the workout: "Part 1", "Station 2:", "Block A", "Round 1 -", "חלק 2", "תחנה 3".
// What follows (if anything) is the block's kind or format: "Part 3 – Metcon", "Station 1 - EMOM 8".
const BLOCK_RE =
  /^[\s\-–:.]*((?:part|station|block|circuit|superset|round|section|set|phase|חלק|תחנה|בלוק|סבב|מעגל|סופרסט)\s*(?:\d{1,2}|[a-z](?![a-z])|[א-ת](?![א-ת]))?)(?:[\s\-–:.)]*)(.*)$/i;
// A long sentence with no sets/reps in it is an explanation, not an exercise.
const MAX_NAME_WORDS = 6;
// "3RM Test", "3–5RM Test", "Up to 3 Attempts"
const RM_TEST_RE = /(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*RM\s*test/i;
const ATTEMPTS_RE = /up to\s+(\d{1,2})\s+attempts?/i;
const DURATION_RE = /[\s\-–:]*\d+\s*(sec|secs|seconds|s|min|mins|minutes|m|שניות|שנ['׳]|דקות|דק['׳]?)\.?$/i;

function roundsFromFormat(format: string | null | undefined): number | null {
  if (!format) return null;
  const m = format.match(/\brft\s*(\d+)|(\d+)\s*(?:rounds?|rft)\b|(\d+)\s*סבבים/i);
  return m ? Number(m[1] ?? m[2] ?? m[3]) : null;
}

interface Reps {
  reps: number;
  repsText: string;
}

/** "10", "12 reps", "8-10", "10–8", "2+1+1" */
export function parseReps(s: string): Reps | null {
  const t = s.replace(REP_WORDS, '').replace(/[.,]$/, '').trim();
  let m = t.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
    return { reps: a, repsText: `${a}–${b}` };
  }
  m = t.match(/^\d{1,3}(\s*\+\s*\d{1,3})+$/);
  if (m) {
    const parts = t.split('+').map((x) => Number(x.trim()));
    return { reps: parts.reduce((a, b) => a + b, 0), repsText: parts.join('+') };
  }
  m = t.match(/^(\d{1,3})$/);
  if (m && Number(m[1]) > 0) return { reps: Number(m[1]), repsText: m[1] };
  return null;
}

/** "3x8", "3 x 8-10", "4 sets × 2+1+1", "10–8 × 1" (a range is always the reps), "10-12", "12 reps" */
export function parsePrescription(s: string): { sets: number | null; reps: number; repsText: string } | null {
  const t = s.trim().replace(/\.$/, '');
  let m = t.match(/^(\d{1,2})\s*(?:sets?|סטים|סטים|סט)\s*(?:of\s*|של\s*)?[x×*]?\s*(.+)$/i);
  if (m) {
    const r = parseReps(m[2]);
    return r ? { sets: Number(m[1]), ...r } : null;
  }
  m = t.match(/^(.+?)\s*[xX×*]\s*(.+)$/);
  if (m) {
    const a = parseReps(m[1]);
    const b = parseReps(m[2]);
    if (!a || !b) return null;
    const aIsReps = /[-–+]/.test(a.repsText) && !/[-–+]/.test(b.repsText);
    return aIsReps ? { sets: b.reps, ...a } : { sets: a.reps, ...b };
  }
  const r = parseReps(t);
  return r ? { sets: null, ...r } : null;
}

/**
 * Splits "Bench Press 10-12" / "ring row-10 reps" / "סקוואט 3x8" / "Back Squat – 6 חזרות" into name + prescription.
 * Also takes the reps first: "10 Bench Press", "3 Weighted Pull-Ups".
 */
function splitExercise(line: string): { name: string; p: ReturnType<typeof parsePrescription> } {
  const lead = line.match(/^(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)\s+(?!reps?\b|sets?\b|sec|min|חזרות|סטים|סט\b|סבבים|שניות|דקות)(\D.*)$/i);
  if (lead && /\p{L}/u.test(lead[2])) {
    const r = parseReps(lead[1]);
    if (r) return { name: lead[2].trim(), p: { sets: null, ...r } };
  }
  const re = /[\s:–\-]+(?=\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const name = line.slice(0, m.index).trim();
    const p = parsePrescription(line.slice(m.index + m[0].length));
    if (p && /\p{L}/u.test(name)) return { name, p };
  }
  // "Heel Elevated Goblet Squat 1½ Reps x8": other numbers in the name, the reps at the end.
  const tail = line.match(/^(.*\p{L}.*?)\s*[xX×*]\s*(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)$/u);
  if (tail) {
    const r = parseReps(tail[2]);
    if (r) return { name: tail[1].replace(/[\s:–\-]+$/, '').trim(), p: { sets: null, ...r } };
  }
  return { name: line.trim(), p: null };
}

function cleanLine(raw: string): string {
  return raw
    .split(/\s+\|\s+/)[0] // "Back Squat – 6 חזרות | RIR 4"
    .replace(/,\s*(?=\D*$)\D*$/, '') // "Reverse Lunges – 6 לכל רגל, קל" (a trailing cue)
    .trim()
    .replace(/^[\s•*·.\-–]+/, '')
    .replace(/[\s.·]+$/, '')
    .replace(/^(?:[A-Za-zא-ת]\d?|\d{1,2})[.)]\s+/, '') // "A." "B1)" "1."
    .trim();
}

function sectionHeader(line: string): { title: string; format: string | null } | null {
  const block = blockHeader(line);
  if (block) return block;
  const dash = line.trim().match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (dash && sectionTitleOf(dash[1]) && FORMAT_RE.test(dash[2].trim())) return { title: dash[1].trim(), format: dash[2].trim() };
  const title = sectionTitleOf(line);
  return title ? { title, format: null } : null;
}

function blockHeader(line: string): { title: string; format: string | null } | null {
  const m = line.trim().match(BLOCK_RE);
  if (!m) return null;
  const head = m[1].trim();
  // Needs its number or letter: "Round" alone is a format word, "Set" alone is nothing.
  if (!/(\d|\s\p{L})$/u.test(head)) return null;
  const rest = m[2].trim();
  if (!rest) return { title: head, format: null };
  if (FORMAT_RE.test(rest)) return { title: head, format: rest };
  const kind = sectionTitleOf(rest);
  return kind ? { title: `${head} ${kind}`, format: null } : null;
}

function sectionTitleOf(line: string): string | null {
  const t = line.trim().replace(/:$/, '');
  const n = normalizeName(t);
  if (!n || /\d/.test(n.replace(/\d+\s*min/, ''))) return null;
  if (knownSections().some((k) => n === k || n.startsWith(k + ' ') || n.endsWith(' ' + k))) return t;
  return line.trim().endsWith(':') && n.split(' ').length <= 3 ? t : null;
}

/**
 * Turns a free-text workout into the exercises to log weights for.
 * Accepts either structured sections or one block of text with section headers in it.
 * Warm-up and metcon sections are skipped; instruction lines (RIR, rest, totals) are ignored.
 */
export function parseWorkout(
  input: string | WorkoutSection[],
  skipSections: string[] = DEFAULT_SKIP_SECTIONS,
  ignoreNames: string[] = [],
): ParsedLine[] {
  const sections: WorkoutSection[] = typeof input === 'string' ? splitSections(input) : input;
  const skip = skipSections.map(normalizeName);
  // Lines a coach marked "not an exercise".
  const ignored = new Set(ignoreNames.map(normalizeName));
  const out: ParsedLine[] = [];
  let lineNo = 0;
  for (const sec of sections) {
    const title = normalizeName(sec.title || '');
    const skipped = title !== '' && skip.some((k) => title === k || title.includes(k));
    const rounds = roundsFromFormat(sec.format);
    const sectionStart = lineNo;
    let last: ParsedLine | null = null;
    // A max test ("3RM Test – Up to 3 Attempts") whose exercise is named on a later "Attempt 1 – 3 ..." line.
    let pendingTest: { sets: number | null; reps: number; repsText: string } | null = null;
    for (const rawLine of sec.text.split(/\r?\n/)) {
      lineNo++;
      const raw = rawLine.trim();
      if (!raw || skipped) continue;
      let line = cleanLine(raw);
      if (!line) continue;

      const test = line.match(RM_TEST_RE);
      if (test) {
        const r = parseReps(test[2] ? `${test[1]}-${test[2]}` : test[1])!;
        const attempts = line.match(ATTEMPTS_RE);
        const name = line.slice(0, test.index).replace(/[\s–\-:]+$/, '').trim();
        const p = { sets: attempts ? Number(attempts[1]) : rounds, ...r };
        if (/\p{L}/u.test(name)) {
          last = { lineNo, raw, name, sets: p.sets, reps: p.reps, repsText: p.repsText, section: sec.title || null };
          out.push(last);
        } else {
          pendingTest = p;
        }
        continue;
      }
      const attempt = line.match(/^attempt\s*\d+\s*[-–:]\s*(.+)$/i);
      if (attempt) {
        if (!pendingTest || NOTE_RE.test(attempt[1])) continue;
        line = attempt[1].trim();
        const { name } = splitExercise(line);
        if (!/\p{L}/u.test(name) || /^reps?\b/i.test(name)) continue;
        last = { lineNo, raw, name, sets: pendingTest.sets, reps: pendingTest.reps, repsText: pendingTest.repsText, section: sec.title || null };
        out.push(last);
        pendingTest = null;
        continue;
      }
      if (NOTE_RE.test(line)) continue;
      if (FORMAT_RE.test(line) && !/[xX×]\s*\d/.test(line)) continue;
      // A line with only a prescription belongs to the exercise above it.
      if (!/\p{L}/u.test(line.replace(/\b(sets?|reps?|of)\b/gi, '').replace(/סטים|סט|של|חזרות|סבבים/g, ''))) {
        const p = parsePrescription(line);
        if (p && last && last.reps == null) {
          last.sets = p.sets ?? last.sets;
          last.reps = p.reps;
          last.repsText = p.repsText;
        }
        continue;
      }
      // A block header inside structured sections ("Part 2", "Station 1") is not an exercise.
      if (blockHeader(line)) {
        last = null;
        continue;
      }
      if (/[?!]$/.test(line)) continue;
      // "Set 1: Back Squat 5", "Station 2 – Bench Press 3x8": the block number goes, the exercise stays.
      line = line.replace(/^(?:part|station|block|round|set|חלק|תחנה|סבב|סט)\s*\d{1,2}\s*[:\-–.)]\s*(?=\p{L})/iu, '');
      const noDuration = line.replace(DURATION_RE, '').trim();
      const { name, p } = splitExercise(noDuration || line);
      if (ignored.has(normalizeName(name)) || ignored.has(normalizeName(line))) {
        last = null;
        continue;
      }
      if (!p && name.split(/\s+/).length > MAX_NAME_WORDS) continue;
      last = {
        lineNo,
        raw,
        name,
        sets: p?.sets ?? rounds,
        reps: p?.reps ?? null,
        repsText: p?.repsText ?? null,
        section: sec.title || null,
      };
      out.push(last);
    }
    // EMOM: the minutes are split between the section's exercises ("EMOM 12" with 2 exercises = 6 sets each).
    const emom = sec.format?.match(/\bemom\s*(\d{1,2})/i);
    const inSection = out.filter((l) => l.section === (sec.title || null) && l.lineNo > sectionStart);
    if (emom && inSection.length && Number(emom[1]) % inSection.length === 0) {
      for (const l of inSection) l.sets ??= Number(emom[1]) / inSection.length;
    }
  }
  return out;
}

function splitSections(text: string): WorkoutSection[] {
  const sections: WorkoutSection[] = [];
  let cur: WorkoutSection = { title: '', format: null, text: '' };
  for (const line of text.split(/\r?\n/)) {
    const header = sectionHeader(line);
    if (header) {
      if (cur.title || cur.text.trim()) sections.push(cur);
      cur = { ...header, text: '' };
      continue;
    }
    if (FORMAT_RE.test(line.trim()) && !cur.text.trim()) {
      cur.format = line.trim();
      cur.text += '\n'; // keep line numbers stable
      continue;
    }
    cur.text += (cur.text ? '\n' : '') + line;
  }
  sections.push(cur);
  return sections;
}

/** @deprecated kept for older callers; same as parseWorkout(text). */
export const parseWorkoutText = (text: string) => parseWorkout(text);

export interface NameIndexEntry {
  exerciseId: number;
  name: string; // the library name, for suggestions
  key: string; // normalized name or alias
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length) || 1;
  let score = 1 - levenshtein(a, b) / max;
  if (a.length >= 3 && (b.includes(a) || a.includes(b))) score = Math.max(score, 0.7);
  return score;
}

export interface MatchResult {
  exerciseId: number | null;
  suggestions: { exerciseId: number; name: string }[];
  /** Matched by a close spelling (a letter missing, a small typo), not by the exact name. */
  close?: boolean;
}

/** A name this close to one exercise, and clearly closer to it than to any other, is that exercise. */
export const CLOSE_MATCH = 0.85;

/**
 * Exact match on normalized name or alias, or a very close spelling of one exercise only (a missing or wrong letter,
 * as coaches type fast). Anything else is unknown and gets up to 3 suggestions for the coach.
 */
export function matchName(name: string, index: NameIndexEntry[]): MatchResult {
  const key = normalizeName(name);
  const exact = index.find((e) => e.key === key);
  if (exact) return { exerciseId: exact.exerciseId, suggestions: [] };

  const best = new Map<number, { exerciseId: number; name: string; score: number }>();
  for (const e of index) {
    const score = similarity(key, e.key);
    const cur = best.get(e.exerciseId);
    if (!cur || score > cur.score) best.set(e.exerciseId, { exerciseId: e.exerciseId, name: e.name, score });
  }
  const ranked = [...best.values()].filter((s) => s.score >= 0.4).sort((a, b) => b.score - a.score);
  const [top, second] = ranked;
  if (top && key.length >= 5 && top.score >= CLOSE_MATCH && (!second || top.score - second.score >= 0.1))
    return { exerciseId: top.exerciseId, suggestions: [], close: true };
  // Only names about as close as the best one: a far third guess is noise.
  const suggestions = ranked.filter((s) => s.score >= top.score - 0.15).slice(0, 3).map(({ exerciseId, name }) => ({ exerciseId, name }));
  return { exerciseId: null, suggestions };
}
