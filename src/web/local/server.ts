// The in-browser version of the server (vite --mode device, published on GitHub Pages).
// The same API code (src/server) runs inside the page against a SQLite database kept in this browser's IndexedDB,
// so everything stays on the phone and no server is needed. api.ts sends its requests here instead of the network.
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { createApp } from '../../server/app.ts';
import { type DB, getSetting, initDb } from '../../server/db.ts';
import { seedLibrary } from '../../server/library.ts';
import { randomBytes } from './node-crypto.ts';
import { type SqlJsDatabase, wrapSqlJs } from './sqljs-db.ts';

const IDB_NAME = 'my-lifts';
const STORE = 'files';
const KEY = 'app.db';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadBytes(): Promise<Uint8Array | undefined> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : undefined);
    req.onerror = () => reject(req.error);
  });
}

async function saveBytes(bytes: Uint8Array): Promise<void> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bytes, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

interface Local {
  SQL: SqlJsStatic;
  raw: SqlJsDatabase;
  db: DB;
  app: ReturnType<typeof createApp>;
}

let ready: Promise<Local> | null = null;
let saving: Promise<void> = Promise.resolve();

function start(): Promise<Local> {
  ready ??= (async () => {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const raw = new SQL.Database(await loadBytes());
    const db = wrapSqlJs(raw);
    initDb(db);
    seedLibrary(db);
    let secret = getSetting(db, 'app_secret');
    if (!secret) {
      secret = randomBytes(32).toString('hex');
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_secret', ?)").run(secret);
    }
    const app = createApp({ db, secret, secureCookies: false, local: true });
    // Ask the browser not to clear this site's storage when space runs low.
    navigator.storage?.persist?.().catch(() => {});
    const local = { SQL, raw, db, app };
    await save(local);
    return local;
  })();
  return ready;
}

/** Writes the whole database to IndexedDB (one at a time, in order). */
function save(l: Local): Promise<void> {
  saving = saving.then(async () => {
    const bytes = l.raw.export();
    // export() reopens the database, which resets pragmas.
    l.raw.exec('PRAGMA foreign_keys = ON');
    await saveBytes(bytes);
  });
  return saving;
}

/** Answers an API request inside the page, like the server would. */
export async function localFetch(path: string, init: RequestInit): Promise<Response> {
  const l = await start();
  const res = await l.app.fetch(new Request(new URL(path, 'http://local'), init));
  if ((init.method ?? 'GET') !== 'GET') await save(l);
  return res;
}

/** The whole database as a file, for a backup. */
export async function exportBackup(): Promise<Uint8Array> {
  const l = await start();
  await saving;
  const bytes = l.raw.export();
  l.raw.exec('PRAGMA foreign_keys = ON');
  return bytes;
}

/** Replaces everything with a backup file. The page reloads afterwards. */
export async function importBackup(bytes: Uint8Array): Promise<void> {
  const l = await start();
  const test = new l.SQL.Database(bytes);
  try {
    test.exec('SELECT id FROM members LIMIT 1');
  } catch {
    throw new Error('זה לא קובץ גיבוי של האפליקציה');
  } finally {
    test.close();
  }
  await saving;
  await saveBytes(bytes);
}
