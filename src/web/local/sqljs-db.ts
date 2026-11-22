// The app's database inside the browser: SQLite compiled to WebAssembly (sql.js), wrapped so it looks like the
// node:sqlite DatabaseSync the server code was written for (prepare().get/all/run, exec).
import type { DB } from '../../server/db.ts';

export interface SqlJsDatabase {
  prepare(sql: string): SqlJsStatement;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  getRowsModified(): number;
  export(): Uint8Array;
  close(): void;
}
interface SqlJsStatement {
  bind(values: unknown[] | Record<string, unknown>): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): boolean;
}

type Param = unknown;

function normalize(v: Param): Param {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'bigint') return Number(v);
  return v;
}

function bind(st: SqlJsStatement, params: Param[]) {
  if (params.length === 0) return;
  const first = params[0];
  if (params.length === 1 && first && typeof first === 'object' && !(first instanceof Uint8Array) && !Array.isArray(first)) {
    // Named parameters: node:sqlite accepts bare names, sql.js wants the prefix. Unused names are ignored.
    const named: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(first as Record<string, Param>)) {
      if (/^[:@$]/.test(k)) named[k] = normalize(v);
      else for (const p of [':', '@', '$']) named[p + k] = normalize(v);
    }
    st.bind(named);
    return;
  }
  st.bind(params.map(normalize));
}

export function wrapSqlJs(raw: SqlJsDatabase): DB {
  const withStatement = <T>(sql: string, params: Param[], fn: (st: SqlJsStatement) => T): T => {
    const st = raw.prepare(sql);
    try {
      bind(st, params);
      return fn(st);
    } finally {
      st.free();
    }
  };
  const db = {
    exec(sql: string) {
      raw.exec(sql);
    },
    prepare(sql: string) {
      return {
        get: (...params: Param[]) => withStatement(sql, params, (st) => (st.step() ? st.getAsObject() : undefined)),
        all: (...params: Param[]) =>
          withStatement(sql, params, (st) => {
            const rows: Record<string, unknown>[] = [];
            while (st.step()) rows.push(st.getAsObject());
            return rows;
          }),
        run: (...params: Param[]) => {
          withStatement(sql, params, (st) => {
            while (st.step());
          });
          const changes = raw.getRowsModified();
          const lastInsertRowid = Number(raw.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0);
          return { changes, lastInsertRowid };
        },
      };
    },
    close() {
      raw.close();
    },
  };
  return db as unknown as DB;
}
