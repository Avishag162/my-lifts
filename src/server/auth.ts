// Single-user login: the first time the app opens you choose a name and a password; after that, the password.
// Sessions are kept in the database (a cookie holds a random token; only its hash is stored).
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { type DB, getSetting } from './db.ts';

export interface SessionMember { id: number; name: string; phone: string; role: string; onboarded_at: string | null; has_password: number }

export const MIN_PASSWORD = 6;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

export function checkPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const given = scryptSync(password, salt, 32);
  return timingSafeEqual(given, Buffer.from(hash, 'hex'));
}

/** The one user of this app, or undefined before setup. */
export function owner(db: DB): { id: number; name: string; password_hash: string | null } | undefined {
  return db.prepare('SELECT id, name, password_hash FROM members ORDER BY id LIMIT 1').get() as any;
}

/** Creates the user (first run) or changes the password (also used by `npm run reset-password`). */
export function setOwnerPassword(db: DB, password: string, name?: string): number {
  if (password.length < MIN_PASSWORD) throw new Error(`password must be at least ${MIN_PASSWORD} characters`);
  const me = owner(db);
  if (me) {
    db.prepare('UPDATE members SET password_hash = ? WHERE id = ?').run(hashPassword(password), me.id);
    db.prepare('DELETE FROM auth_sessions WHERE member_id = ?').run(me.id);
    if (name?.trim()) db.prepare('UPDATE members SET name = ? WHERE id = ?').run(name.trim(), me.id);
    return me.id;
  }
  const { lastInsertRowid } = db
    .prepare("INSERT INTO members (name, phone, role, active, password_hash) VALUES (?, 'local', 'trainee', 1, ?)")
    .run(name?.trim() || 'אני', hashPassword(password));
  return Number(lastInsertRowid);
}

export type LoginResult = { ok: true; token: string; expiresAt: number } | { ok: false; error: 'no_user' | 'wrong_password' | 'locked' };

export class Auth {
  private now: () => number;
  private failures = 0;
  private lockedUntil = 0;

  constructor(
    private db: DB,
    private cfg: { secret: string; now?: () => number },
  ) {
    this.now = cfg.now ?? Date.now;
  }

  private hash(value: string): string {
    return createHmac('sha256', this.cfg.secret).update(value).digest('hex');
  }

  /** 5 wrong passwords lock the login for 10 minutes. */
  login(password: string): LoginResult {
    const me = owner(this.db);
    if (!me) return { ok: false, error: 'no_user' };
    if (this.lockedUntil > this.now()) return { ok: false, error: 'locked' };
    if (!checkPassword(password, me.password_hash)) {
      this.failures++;
      if (this.failures >= MAX_ATTEMPTS) {
        this.failures = 0;
        this.lockedUntil = this.now() + LOCK_MINUTES * 60_000;
        return { ok: false, error: 'locked' };
      }
      return { ok: false, error: 'wrong_password' };
    }
    this.failures = 0;
    return { ok: true, ...this.createSession(me.id) };
  }

  createSession(memberId: number): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.now() + Number(getSetting(this.db, 'session_days')) * 86_400_000;
    this.db.prepare('INSERT INTO auth_sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)').run(this.hash(token), memberId, expiresAt);
    return { token, expiresAt };
  }

  memberForToken(token: string | undefined): SessionMember | null {
    if (!token) return null;
    const row = this.db
      .prepare(
        `SELECT m.id, m.name, m.phone, m.role, m.onboarded_at, m.password_hash IS NOT NULL AS has_password FROM auth_sessions s JOIN members m ON m.id = s.member_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND m.active = 1`,
      )
      .get(this.hash(token), this.now()) as SessionMember | undefined;
    return row ?? null;
  }

  logout(token: string) {
    this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(this.hash(token));
  }

  /** "Log out of all devices". */
  logoutAll(memberId: number) {
    this.db.prepare('DELETE FROM auth_sessions WHERE member_id = ?').run(memberId);
  }
}
