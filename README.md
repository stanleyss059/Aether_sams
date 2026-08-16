# StudyForge

Upload lecture notes. Get study summaries and multiple-choice quizzes generated **from that file**, not from a generic question bank.

## Local run

You need Node.js 22+.

1. Copy `backend/.env.example` → `backend/.env` and fill in values (database URLs, session secret, Supabase URL/anon key, OpenAI-compatible key).
2. Copy `frontend/.env.example` → `frontend/.env` with the same Supabase URL + anon key.

3. Install and start:

```powershell
cd C:\Users\stanl\Desktop\StudyForge
npm install
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
cd ..
npm run dev
```

4. Open **http://localhost:5174** and **Register** a new account (auth is handled by Supabase).

In the Supabase dashboard, under **Authentication → Providers → Email**, you can turn off “Confirm email” for local testing so signup signs you in immediately.

## Vercel deploy

1. In the Vercel project, set **Framework** to **Services**.
2. Root directory: `./`
3. Add environment variables (Production + Preview):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** string (port 6543) |
| `DIRECT_URL` | Supabase **session pooler** string (port 5432, used for migrations) |
| `SESSION_SECRET` | Random string, at least 32 characters |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_URL` | Same URL (frontend) |
| `VITE_SUPABASE_ANON_KEY` | Same anon key (frontend) |
| `OPENAI_API_KEY` | OpenAI or OpenRouter key |
| `OPENAI_BASE_URL` | e.g. `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | e.g. `openai/gpt-4o-mini` |
| `FRONTEND_URL` | Your live site URL, e.g. `https://your-app.vercel.app` |

4. Redeploy after saving env vars.
5. Migrations are **not** run during the build, so a missing variable can never block a deploy. Apply schema changes yourself before deploying:

```powershell
cd backend
npx prisma migrate deploy
```

6. Seed is **not** automatic on Vercel — create an account with **Register** in the app (Supabase Auth).
7. Check `/api/health` and `/api/health/db` on the deployment to confirm environment and database connectivity.

SQLite is not supported. Both local and production use the Postgres database that ships with your Supabase project (**Connect** button in the dashboard → **ORMs / Prisma**).

## What it does

- Private accounts and course spaces
- PDF, Word (.docx), and text uploads
- Study notes + MCQs generated only from your material
- Quizzes with progress saved in the browser until submit