# Aether

Upload lecture notes. Get study summaries and multiple-choice quizzes generated **from that file**, not from a generic question bank.

**New here?** Read the [User Guide](USER_GUIDE.md) for sign-up, spaces, uploads, and quizzes.

## Local run

You need Node.js 22+.

1. Copy `backend/.env.example` → `backend/.env` and fill in values (database URLs, session secret, Supabase URL/anon key, OpenAI-compatible key, and `ADMIN_EMAIL` for the admin console).
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

In the Supabase dashboard:

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to your live site, e.g. `https://your-app.vercel.app` (no trailing slash).
3. Under **Redirect URLs**, add all of these (no trailing slash):
   - `http://localhost:5174/reset-password`
   - `https://your-app.vercel.app/reset-password`
   - `https://your-app.vercel.app/**`
   - `https://*.vercel.app/**` (covers preview deploys)
4. Save, then request a **new** reset email. Old emails keep the previous redirect.

If the link still opens a Vercel login wall, turn off **Deployment Protection** for Production in the Vercel project.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service role** key (server uploads to the `files` Storage bucket) |
| `VITE_SUPABASE_URL` | Same URL (frontend) |
| `VITE_SUPABASE_ANON_KEY` | Same anon key (frontend) |
| `OPENAI_API_KEY` | OpenAI or OpenRouter key |
| `OPENAI_BASE_URL` | e.g. `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | e.g. `openai/gpt-4o-mini` |
| `FRONTEND_URL` | Your live site URL, e.g. `https://your-app.vercel.app` |
| `ADMIN_EMAIL` | Email of the account that should receive admin access (case-insensitive) |

4. Redeploy after saving env vars.
5. Migrations are **not** run during the build, so a missing variable can never block a deploy. Apply schema changes yourself before deploying:

```powershell
cd backend
npx prisma migrate deploy
```

6. Seed is **not** automatic on Vercel — create an account with **Register** in the app (Supabase Auth).
7. Set `ADMIN_EMAIL` to that account’s email, then sign in again (or redeploy) so Aether promotes it to `ADMIN`. Open **Admin** in the nav for the activity console (users, uploads, spaces, profile, audit logs).
8. Check `/api/health` and `/api/health/db` on the deployment to confirm environment and database connectivity.

SQLite is not supported. Both local and production use the Postgres database that ships with your Supabase project (**Connect** button in the dashboard → **ORMs / Prisma**).

## What it does

- Private accounts and course spaces
- PDF, Word (.docx), PowerPoint (.ppt / .pptx), and text uploads
- Study notes + MCQs generated only from your material
- Quizzes with progress saved in the browser until submit
- Admin console (`ADMIN_EMAIL`) with users, uploads, spaces, and audit logs