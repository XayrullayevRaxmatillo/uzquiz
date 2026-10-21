# UZQUIZ

Real-time multiplayer quiz platform (UZ / RU / EN): quizzes, teams, live rooms, leaderboards, XP and achievements.

- **client/** — React 19 + TypeScript + Vite 7 + Tailwind v4, Framer Motion, TanStack Query, socket.io-client
- **server/** — Node 20+ · Express 5 · MongoDB (Mongoose) · Socket.IO

> The code was written without being able to run `npm install` in the authoring environment, so it has **not been compiled or tested there**. Run the checks in step 5 first and fix anything they report.

## 1. Requirements (Windows)

- Node.js 20 or newer (`node -v`)
- A MongoDB database: **MongoDB Atlas** (free M0) or a local MongoDB

## 2. MongoDB Atlas setup

1. Create a free cluster at https://cloud.mongodb.com.
2. *Database Access* → add a user with a strong password (read/write on any database).
3. *Network Access* → add your IP (use `0.0.0.0/0` only temporarily, or for a host without a fixed IP).
4. *Connect → Drivers* → copy the `mongodb+srv://…` string and put your database name in it, e.g. `…mongodb.net/uzquiz?retryWrites=true&w=majority`.
5. If the password contains special characters, URL-encode them.

## 3. Configure (PowerShell)

```powershell
cd uzquiz\server
Copy-Item .env.example .env
# Generate a JWT secret and paste it into .env as JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
notepad .env      # set MONGODB_URI and JWT_SECRET
```

`.env` is git-ignored. Never commit real secrets. Without SMTP settings, verification and reset links are printed in the server console (development only).

## 4. Install and run

One command (PowerShell, from the project root): `.\setup.ps1` then `.\start.ps1`.

Or manually, two terminals:

```powershell
# Terminal 1 — API on http://localhost:4000
cd uzquiz\server
npm install
npm run seed       # categories + demo quizzes (flagged "Demo")
npm run dev

# Terminal 2 — web app on http://localhost:5173
cd uzquiz\client
npm install
npm run dev
```

Vite proxies `/api` and `/socket.io` to port 4000, so no client `.env` is needed locally.

### Admin account

Set these in `server/.env` **before** `npm run seed` (choose your own values; nothing is shipped with default credentials):

```
SEED_ADMIN_EMAIL=you@example.com
SEED_ADMIN_USERNAME=youradmin
SEED_ADMIN_PASSWORD=<a strong password>
```

Demo quizzes belong to a non-loginable demo owner and are labelled "Demo" in the UI. No fake users, scores or leaderboard entries are created.

## 5. Checks and tests

```powershell
cd uzquiz\server; npm run typecheck; npm test      # uses an in-memory MongoDB (downloads a binary on first run)
cd ..\client;     npm run typecheck; npm test; npm run build
```

Server tests cover auth, teams (atomic join, roles), quizzes (answers never leak), the live game flow and admin RBAC. Client tests cover i18n key parity, the API wrapper and form validation.

## 6. Features

- Auth: register, login, logout, forgot/reset password, email verification, change password, onboarding. Argon2 hashing, httpOnly cookie session, CSRF token, rate limits, no account enumeration.
- Quizzes: library with search/filters, favorites, ratings, reports, editor, duplicate, private quizzes.
- Teams: discovery, create/join/request/accept/reject/leave, invite codes, roles, Quick Match, notifications.
- Live games: room code, lobby with ready state, host start/pause/resume/end/kick, server-side scoring and timers, speed bonus, reconnect, rematch, team mode.
- Progress: results, global/weekly/category/team/friends leaderboards, XP, levels, streaks, achievements, daily challenge.
- Admin (server-enforced roles): overview, users, quizzes, teams, live rooms, reports, categories.

Anti-abuse rules: leaderboard counts only games with 2+ players and the best score per quiz; XP is awarded once per user and quiz per UTC day.

**Limitation:** live game state lives in memory, so run **one** server instance. Scaling out needs the Socket.IO Redis adapter and moving room state to Redis.

## 7. Deployment

**API (Render / Railway / Fly):**
- Build `npm install && npm run build`, start `npm start`.
- Env: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN=https://your-frontend`, `APP_URL=https://your-frontend`, SMTP vars, and `COOKIE_SAMESITE=none` if frontend and API are on different sites (requires HTTPS).
- Single instance; keep WebSockets enabled.

**Web (Vercel / Netlify / Cloudflare Pages):**
- Root `client`, build `npm run build`, output `dist`.
- Env: `VITE_API_URL=https://your-api/api`, `VITE_SOCKET_URL=https://your-api`.
- Add an SPA rewrite of all paths to `index.html`.

Atlas: allow your host's outbound IPs (or `0.0.0.0/0` with a strong password).

## 8. Structure

```
client/src  components/ context/ hooks/ i18n/ lib/ pages/ __tests__/
server/src  config/ middleware/ models/ modules/{auth,users,teams,quizzes,rooms,stats,admin,meta} sockets/ scripts/seed.ts __tests__/
```
