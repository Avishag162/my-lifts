# Notes for Claude

A single-user strength-training log. UI in Hebrew (RTL). Stack: Node 22 + TypeScript run by tsx, Hono API,
SQLite through `node:sqlite`, React + Vite, vitest.

## Layout

| Path | What it holds |
| --- | --- |
| `src/server/index.ts` | Starts the server, opens the database, seeds the exercise library |
| `src/server/app.ts` | Every API route |
| `src/server/auth.ts` | One user, one password, cookie sessions |
| `src/server/db.ts` | Table definitions and settings |
| `src/server/workouts.ts` | Opening a workout, logging sets, history, "last time" and the recommended target |
| `src/server/rules.ts` | Recommended weight, personal records, estimated 1RM |
| `src/server/analytics.ts`, `achievements.ts` | Badges, challenges, monthly summary |
| `src/server/progress.ts`, `src/shared/muscles.ts` | Progress per muscle group |
| `src/server/library.ts`, `exercise-data.ts` | Starter exercises, pictures, videos, cues; adding exercises |
| `src/server/time.ts` | The time zone (`TIME_ZONE`) |
| `src/web/` | The React app (screens in `src/web/screens/`) |
| `scripts/draw-exercises.ts` | Draws the exercise SVGs in `src/web/public/exercises/` |

## How the data fits

A workout session is a row in `classes` (class_type `אימון`), opened with `POST /api/solo` for a date. What
you log goes to `workouts` -> `exercise_entries` -> `set_entries`. The name "class" is historical: the app grew out of a
gym's class tracker.

## Working on it

- `npm run dev` for the app, `npm test` and `npm run typecheck` before committing.
- The database is created on first run; new columns need a migration in `openDb` (e.g. `ALTER TABLE ... ADD COLUMN`
  wrapped in try/catch) so an existing `data/app.db` keeps working.
- Never commit `data/` or `*.db` (git-ignored): that is the user's real training history.
