// Forgot the password? Run on the computer that runs the app:  npm run reset-password -- 'my new password'
// Logs out every device. Creates the user if the app was never set up.
import { setOwnerPassword } from '../src/server/auth.ts';
import { openDb } from '../src/server/db.ts';

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run reset-password -- 'new password'");
  process.exit(1);
}
const db = openDb(process.env.DB_PATH ?? 'data/app.db');
setOwnerPassword(db, password);
console.log('Password changed. Log in with the new password.');
