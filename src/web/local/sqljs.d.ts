declare module 'sql.js' {
  type SqlJsDatabase = import('./sqljs-db.ts').SqlJsDatabase;
  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => SqlJsDatabase;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
