# AutoPost AI — Full-Stack Scaffold

A working starting point for the platform you described: users connect a Facebook
Page, set a topic once, and AI generates + publishes fresh posts on a schedule.
Admins control users, plans, AI providers, and global settings.

## Stack
- **Backend:** Node.js + Express + Prisma (SQLite for dev, swap to Postgres for prod) + node-cron scheduler
- **Frontend:** React (Vite) + React Router
- **Auth:** JWT, bcrypt password hashing
- **AI:** Pluggable providers — OpenAI / Claude / Gemini / Grok for text, OpenAI Images / Imagen / Flux / Stability for images
- **Facebook:** Official Facebook Login (OAuth) + Graph API publishing

## What's implemented vs. what you still need to add

**Implemented (real logic, ready to run):**
- Signup/login, JWT auth, roles (user/admin)
- Facebook Login OAuth flow + Page selection + Graph API publishing (text & photo posts)
- Automation config (topic, language, tone, up to 3 posting times, page selection)
- Scheduler that runs every minute, generates a new subtopic + post + image per
  scheduled slot, publishes to Facebook, logs success/failure, retries failures
- Admin dashboard (users, active users, today's posts, published, failed, revenue)
- User management (activate/suspend/change plan/reset API/activity log)
- Plans CRUD (max pages, max posts/day, AI tier, price)
- AI API management (per-provider key storage + active-provider switch, no code changes needed)
- Global settings (max daily posts, image orientation, hashtag count, creativity, watermark toggle, retry toggle)
- Image watermarking (bottom-right text overlay via `sharp`, toggled by Admin → Settings)

**You still need to plug in for production:**
- Actual payment collection (spec says activation is **manual** — user pays out of
  band, admin clicks Activate; a Stripe webhook stub is included at
  `backend/src/routes/webhook.routes.js` if you want to automate that later)
- A Facebook Developer App (App ID/Secret) in Meta's App Review — required for
  `pages_manage_posts` in production, since Facebook reviews apps that publish
  on users' behalf
- Real API keys for whichever text/image providers you choose (enter them in
  Admin → AI API Management, or in `.env` for local dev)
- Production database (Postgres) + hosting (Render/Railway/Fly.io/VPS for
  backend, Vercel/Netlify for frontend)
- HTTPS + a real domain for the Facebook OAuth redirect URI

## Local setup

### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed        # creates Basic/Premium plans + an admin login
npm run dev         # starts on http://localhost:4000
```
The seed script prints the admin email/password to the console — log in with
those, then change the password.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev          # starts on http://localhost:5173
```

### Option: Docker Compose (both services at once)
```bash
cp backend/.env.example backend/.env   # fill in real values first
docker compose up --build
```
This runs the backend on `:4000` and frontend on `:5173`. Note: Vite bakes
`VITE_API_URL` in at *build* time, so if your backend URL changes, update the
`args.VITE_API_URL` in `docker-compose.yml` and rebuild rather than just
restarting.

### 3. Facebook App setup (required before "Connect Facebook" works)
1. Create an app at https://developers.facebook.com → type "Business"
2. Add the "Facebook Login" product
3. Under Login Settings, add `http://localhost:4000/api/facebook/callback` as a
   valid OAuth redirect URI
4. Copy the App ID/Secret into `backend/.env`
5. For production posting (`pages_manage_posts`), Meta requires App Review —
   budget time for this before launch

### 4. AI providers
Either set keys in `backend/.env` for local dev, or log in as admin and add
them under **AI API Management** — the database value takes priority. Without
any key configured, the app runs in a labeled "DEMO MODE" so you can test the
full pipeline (scheduling → generation → publishing) before wiring real keys.

## Architecture notes

- **Scheduler design:** each posting-time slot generates its own unique
  subtopic + post (so a Premium user with 3 daily times gets 3 distinct posts,
  not the same content repeated). Subtopic history is tracked per automation
  so the AI avoids repeating itself.
- **Timezones:** the scheduler currently compares against UTC time. For a
  production launch, either store each user's timezone and convert, or fix
  the server's timezone and document it clearly for users when they pick
  posting times.
- **Security:** API keys are stored in the database as plaintext in this
  scaffold for simplicity — before production, encrypt them at rest (e.g.
  with `crypto` + a key from a secrets manager) since anyone with DB access
  could otherwise read them.
- **Plan enforcement:** posting-time count, page count, and daily post count
  are all capped server-side against the user's plan on every request — the
  frontend just reflects those limits, it doesn't enforce them.

## Deploying

- **Backend:** any Node host (Render, Railway, Fly.io, a VPS). Switch
  `datasource db` in `prisma/schema.prisma` to `postgresql`, set
  `DATABASE_URL` to your Postgres instance, run `npx prisma migrate deploy`.
- **Frontend:** `npm run build` → deploy the `dist/` folder to Vercel,
  Netlify, or any static host. Set `VITE_API_URL` to your backend's public URL.
- Generated images are currently saved to `backend/uploads/generated` and
  served statically — for production, upload them to S3/Cloudinary instead so
  they survive redeploys and are reliably publicly reachable (Facebook's
  `/photos` endpoint needs a public URL).
