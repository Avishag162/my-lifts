# המשקלים שלי · My Lifts

<div dir="rtl">

אפליקציית ווב אישית לטלפון לרישום אימוני כוח: פותחים אימון ליום, מוסיפים תרגילים מהספרייה (או תרגיל משלך), ורושמים משקל וחזרות לכל סט. בפעם הבאה רואים מה הרמת בפעם הקודמת ויעד מומלץ. יש שיאים אישיים, גרפים של התקדמות לפי תרגיל וקבוצת שריר, תגים, סיכום חודשי ותמונה לשיתוף בסטורי.

האפליקציה לאדם אחד: בפעם הראשונה בוחרים שם וסיסמה, ומאז נכנסים עם הסיסמה. כל הנתונים נשמרים בקובץ אחד במחשב שמריץ אותה (`data/app.db`). אין חיבור לשום שירות חיצוני.

## הרצה במחשב

צריך [Node.js](https://nodejs.org) גרסה 22 ומעלה.

```bash
npm install
npm run dev
```

פותחים בדפדפן את http://localhost:5173 ובוחרים שם וסיסמה.

כדי להריץ כמו גרסה סופית (שרת אחד, על http://localhost:3000):

```bash
npm run build
npm start
```

פקודות נוספות:

| פקודה | מה היא עושה |
| --- | --- |
| `npm test` | בדיקות |
| `npm run typecheck` | בדיקת טיפוסים |
| `npm run reset-password -- 'סיסמה חדשה'` | שכחת סיסמה? מחליף אותה ומנתק את כל המכשירים |

## להשתמש בזה מהטלפון

**הדרך הפשוטה (חינם, בלי שרת):** הגרסה ״במכשיר״ מריצה את כל האפליקציה בתוך הדפדפן ושומרת את הנתונים בטלפון עצמו. בכל עדכון של `main` היא מתפרסמת אוטומטית ב-GitHub Pages (`.github/workflows/pages.yml`), בכתובת `https://<שם המשתמש>.github.io/my-lifts/`. בפעם הראשונה: ב-GitHub, Settings ← Pages ← Source: **GitHub Actions**. הנתונים לא יוצאים מהטלפון, ולכן כדאי מדי פעם ״הורדת גיבוי״ במסך הפרופיל.

**או עם שרת** (הנתונים נשמרים בשרת ונגישים מכל מכשיר):

האפליקציה צריכה לרוץ על שרת שהטלפון מגיע אליו. הדרך הפשוטה: לבקש מ-Claude Code ״תעלה את האפליקציה לשרת״ (למשל Render, Railway או Fly.io). שימו לב:

- מסד הנתונים הוא קובץ SQLite. בשרת צריך דיסק קבוע (volume) ולהגדיר `DB_PATH` לקובץ שעליו, אחרת הנתונים נמחקים בכל עדכון.
- בשרת עם https מגדירים `SECURE_COOKIES=true`.
- בחינם: Render (תוכנית Free, לפי `render.yaml`) עם מסד נתונים חינמי ב-[Turso](https://turso.tech). מגדירים ב-Render את `TURSO_DATABASE_URL` ו-`TURSO_AUTH_TOKEN`, והנתונים נשמרים ב-Turso.
- בטלפון: פותחים את הכתובת ו״הוספה למסך הבית״, והאפליקציה נפתחת כמו אפליקציה רגילה.

## להמשיך לפתח עם Claude Code

1. פותחים ריפו חדש ב-GitHub ומעלים אליו את התיקייה הזו.
2. פותחים את הריפו ב-Claude Code ומבקשים בשפה חופשית, למשל ״תוסיף טיימר מנוחה בין סטים״ או ״תוסיף אפשרות לייצא את האימונים לאקסל״.
3. בקובץ `CLAUDE.md` יש ל-Claude Code הסבר קצר על מבנה הקוד.

</div>

---

## English

A personal mobile web app for logging strength workouts: open a workout for a day, add exercises from the library (or your own), and log weight and reps per set. Next time you see what you lifted last time and a recommended target. Personal records, progress charts per exercise and muscle group, badges, a monthly summary and a shareable story image.

It is for one person: on first run you choose a name and a password; after that you log in with the password. All data lives in one SQLite file on the machine that runs it (`data/app.db`). It talks to no outside service.

### Run it

Needs Node.js 22+.

```bash
npm install
npm run dev        # API on :3000, app on http://localhost:5173
npm test
npm run build && npm start   # production-style, one server on http://localhost:3000
npm run reset-password -- 'new password'
```

On-device version: `npm run build:local` (`vite build --mode device`) bundles the server code into the page and keeps the SQLite database (sql.js) in the browser's IndexedDB; `.github/workflows/pages.yml` publishes it to GitHub Pages. `npm run dev:local` runs it locally.

Environment variables (all optional): `PORT` (default 3000), `DB_PATH` (default `data/app.db`), `APP_SECRET` (session signing key; generated and stored in the database if not set), `SECURE_COOKIES=true` (when served over https).

### Keep building with Claude Code

Push this folder to a new GitHub repository, open it in Claude Code, and ask for what you want in plain words. `CLAUDE.md` gives Claude Code a short map of the code.
