import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

export type DB = DatabaseSync;

// A "class" is one workout session (a day). Each has its exercises (class_exercises, optional: a planned list)
// and you log what you did in workouts -> exercise_entries -> set_entries.
const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  body_area TEXT NOT NULL,            -- legs, back, chest, shoulders, arms, glutes, core
  equipment TEXT NOT NULL,            -- barbell, dumbbell, kettlebell, machine, cable, ball, bodyweight
  weight_step REAL NOT NULL DEFAULT 2.5,
  tracks_weight INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  video_url TEXT,
  media_auto INTEGER NOT NULL DEFAULT 0,  -- 1 = picture/video chosen automatically when the exercise was added
  cues TEXT,                              -- technique cues, one per line
  created_by INTEGER REFERENCES members(id),
  created_at TEXT,
  created_guess INTEGER NOT NULL DEFAULT 0,
  muscle_groups TEXT                      -- other muscle groups by id, comma separated; NULL = guessed by name
);

CREATE TABLE IF NOT EXISTS exercise_aliases (
  alias_key TEXT PRIMARY KEY,         -- normalized
  alias TEXT NOT NULL,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE
);

-- The app has one user (the first row).
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,         -- not used; 'local'
  role TEXT NOT NULL DEFAULT 'trainee',
  active INTEGER NOT NULL DEFAULT 1,
  onboarded_at TEXT,
  password_hash TEXT,                 -- scrypt, "salt:hash"
  injury TEXT,
  injury_at TEXT,
  injury_by INTEGER REFERENCES members(id),
  gender TEXT,                        -- f | m, optional: wording of badges
  bodyweight REAL,                    -- optional: "x times bodyweight" badges
  birthday TEXT                       -- MM-DD, optional: birthday badge
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  class_type TEXT NOT NULL,
  starts_at TEXT NOT NULL,            -- ISO
  synced_at TEXT NOT NULL             -- when it was opened (or reopened)
);

CREATE TABLE IF NOT EXISTS class_exercises (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  raw_name TEXT NOT NULL,
  exercise_id INTEGER REFERENCES exercises(id),
  sets INTEGER,
  reps INTEGER,
  reps_text TEXT,
  section TEXT,
  UNIQUE (class_id, line_no)
);

CREATE TABLE IF NOT EXISTS attendance (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id),
  attended INTEGER,
  PRIMARY KEY (class_id, member_id)
);

CREATE TABLE IF NOT EXISTS unknown_names (
  id INTEGER PRIMARY KEY,
  name_key TEXT NOT NULL UNIQUE,
  raw_name TEXT NOT NULL,
  first_class_id INTEGER REFERENCES classes(id),
  suggestions TEXT NOT NULL,
  resolved_exercise_id INTEGER REFERENCES exercises(id),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  class_id INTEGER REFERENCES classes(id),
  date TEXT NOT NULL,                 -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  solo INTEGER NOT NULL DEFAULT 0,    -- 1 = left out of workout counts and streaks (always 0 here)
  UNIQUE (member_id, class_id)
);

CREATE TABLE IF NOT EXISTS exercise_entries (
  id INTEGER PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER REFERENCES exercises(id),
  raw_name TEXT NOT NULL,
  class_exercise_id INTEGER REFERENCES class_exercises(id),
  target_reps INTEGER,
  feel TEXT,                          -- easy | challenging | very_hard
  note TEXT,
  created_at TEXT NOT NULL,
  entered_by INTEGER REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS set_entries (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES exercise_entries(id) ON DELETE CASCADE,
  set_no INTEGER NOT NULL,
  weight REAL,
  reps INTEGER NOT NULL,
  is_pr INTEGER NOT NULL DEFAULT 0
);

-- Exercises deleted from the library (name, normalized): starter ones aren't added back.
CREATE TABLE IF NOT EXISTS deleted_exercises (
  name_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  deleted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_exercise ON exercise_entries(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workouts_member ON workouts(member_id, date);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  // How long a login lasts on a device.
  session_days: '90',
};

/**
 * Opens the database. Normally a local SQLite file at `path`.
 * When TURSO_DATABASE_URL is set (a free cloud host with no lasting disk), `path` is a local copy kept in sync with
 * the Turso database, which holds the real data: reads are local, writes go to Turso. Needs the `libsql` package.
 */
export function openDb(path: string): DB {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  if (tursoUrl && path !== ':memory:') return initDb(openTurso(path, tursoUrl));
  const db = new DatabaseSync(path);
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  return initDb(db);
}

function openTurso(path: string, url: string): DB {
  // libsql has the same synchronous prepare/get/all/run/exec API as node:sqlite for everything this app uses.
  const Database = createRequire(import.meta.url)('libsql');
  const db = new Database(path, { syncUrl: url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
  db.sync();
  console.log('Database: Turso (synced)');
  return db as DB;
}

/** Creates the tables (if missing) and default settings. Also used by the in-browser version (src/web/local). */
export function initDb(db: DB): DB {
  db.exec(SCHEMA);
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);
  return db;
}

export function getSetting(db: DB, key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
