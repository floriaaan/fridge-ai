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
9. **households/Create household** (or **Join household**) is a prerequisite for
   every request below — `fridge`/`receipt` routes all sit behind
   `household_required_middleware` (403 `no_household` without one).
10. **settings/Get AI settings**, then **settings/Set active AI provider** (owner
    only) — switches which AI provider **receipt/Scan receipt** will actually call.
11. **fridge/Create product** captures `{{productId}}`, used by **Get/Update/Delete
    product** and **Expiring soon**.
12. **fridge/Lookup product by barcode** — real OpenFoodFacts call, no
    prerequisite.
13. **receipt/Scan receipt** needs a real AI provider configured (see step 10) —
    everything else in this collection works with zero external credentials.
14. **receipt/Import receipt** captures `{{receiptId}}`, used by **List/Get
    receipt**. Doesn't require having run Scan first — the import body is
    hand-editable, matching what the app would send after the user reviews/edits
    the scanned draft.

15. **shopping-list/Create shopping item** captures `{{itemId}}`, used by
    **Toggle/Delete shopping item**.
16. **recipe/Generate recipes** and **recipe/Recipe suggestions** need a real
    AI provider configured (see step 10) — **recipe/Save recipe** works with
    zero external credentials and also captures `{{recipeId}}`, used by
    **Get/Delete recipe**.

Covers Phase 3 (`shopping-list`, `recipe`) on top of Phase 1 (`identity`,
`household`) and Phase 2 (`fridge`, `receipt`, `settings`) — the full MVP v1
scope from `docs/phase-0/00-overview-et-points-a-valider.md`.
