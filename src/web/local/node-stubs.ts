// Stands in for node:sqlite, node:fs, node:path and node:module in the in-browser build (vite --mode local).
// src/server/db.ts imports them for openDb(), which the browser never calls: it opens its database in ./sqljs-db.ts.
const unavailable = (what: string) => () => {
  throw new Error(`${what} is not available in the browser`);
};

export class DatabaseSync {
  constructor() {
    unavailable('node:sqlite')();
  }
}
export const mkdirSync = unavailable('node:fs');
export const dirname = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf('/')));
export const createRequire = () => unavailable('require');
export default {};
