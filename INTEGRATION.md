# PHNTM × Supabase — DONE (cloud sync + auth)

The app is now wired to Supabase for **real login** and **cross-device sync**. Data no longer
lives only in each browser — it lives in your Supabase project, scoped per user.

## What was wired
- `phntm-supabase.js` — loads the Supabase client, exposes `window.PHNTM.auth` (sign in / sign
  up / reset password / sign out) and `window.PHNTM.cloud` (load/save all data).
- **Login** (`PHNTM Login.dc.html`) — sign in and create account now go through Supabase Auth;
  "Forgot?" sends a real reset email.
- **Dashboard** (`PHNTM Dashboard.dc.html`) — on load it fetches your data from Supabase and,
  on every change, saves back to it (while keeping localStorage as an instant/offline cache).
- Storage model: one **key-value table** (`kv`) mirroring the old localStorage keys — see
  `schema.sql`. Simpler and safer than a column-per-field mapping for this app.

## YOU MUST DO TWO THINGS in the Supabase dashboard

### 1. Create the table (once)
Supabase → **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.

### 2. Turn OFF email confirmation (recommended for now)
Supabase → **Authentication → Sign In / Providers → Email** → turn **"Confirm email" OFF** →
Save. This lets sign-up log you straight in. If you leave it ON, new accounts must click a
confirmation link in their email before they can sign in (the app will tell them to).

## How sync behaves
- **First device you log in on** pushes its existing local data up to the cloud (one-time
  migration) if the cloud is still empty. **Log in first on the device that has your 20 trades**
  so those become the source of truth.
- After that, every other device you sign in on pulls that same data down.
- The publishable key in `phntm-supabase.js` is safe to ship in client code (it's the public
  key); Row Level Security in `schema.sql` is what actually protects each user's rows.

## Keys stored in `kv`
`phntm-my-trades-v1`, `phntm-challenges-v1`, `phntm-notes-v1`, `phntm-note-cats-v1`,
`phntm-rules-v1`, `phntm-routines-v1`, `phntm-history-v1`, `phntm-body-v1`, `phntm-sleep-v1`,
`phntm-days-v1`, `phntm-account-v2`, `phntm-food-v2`, `phntm-name`.
