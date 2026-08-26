# Bruno collection — Fridge AI backend

Open this folder (`backend/bruno/`) in the [Bruno](https://www.usebruno.com/) app, or
run it headless with `bru run --env local` (Bruno CLI, `npm i -g @usebruno/cli`).

Select the **local** environment (`http://localhost:3333`, matches `backend/.env`'s
default `PORT`) before running requests — start the backend first (`task dev` from the
repo root, or `pnpm run dev` in `backend/`).

## Flow

1. **health/Health** — sanity check, no auth.
2. **identity/Sign up** (or **Sign in**) — captures the session cookie into the
   `{{cookie}}` collection variable, used by every authenticated request below.
3. **identity/Session**, **identity/Auth methods** — read-only, no household needed.
4. **households/Create household** — captures the invite code into `{{inviteCode}}`.
5. **households/My household** — reflects the household just created.
6. To exercise **households/Join household**, run **Sign up** again with a different
   email first (an owner can't join their own household) — the collection only tracks
   one cookie at a time, so re-running Sign up/Sign in overwrites it.
7. **households/Regenerate invite code**, **Remove member**, **Leave household**,
   **Delete household** — see each request's `docs` block for who's allowed to call it.
8. **identity/Sign out** — clears the session server-side (the `{{cookie}}` var itself
   isn't cleared; sign up/in again to get a fresh one).

Only Phase 1 (identity + household) is covered — `/api/products`, `/api/receipts`, etc.
from `docs/phase-0/04-endpoints-http.md` land in a later phase.
