# Farm Hisab — ફાર્મ હિસાબ

A simple farm management and profitability app for a family farm in Kadoli, Himatnagar, Gujarat.
It is a Progressive Web App: install it on an Android phone, record work in the field, and see
which farm and which crop actually made money.

- **Frontend:** React + TypeScript + Vite + Tailwind CSS (static hosting, no backend server)
- **Database & auth:** Supabase (PostgreSQL + Row Level Security)
- **Charts:** Recharts
- **Languages:** English and Gujarati
- **Hosting:** GitHub Pages (free tier), Supabase free tier

Everything runs on free tiers. There are no paid APIs, no SMS, no maps and no analytics services.

---

## Quick start (the only 3 things you must do)

The app is finished. These three steps need your own accounts, so they cannot be done for you.

1. **Make a free Supabase project** at <https://supabase.com> → open *SQL Editor* → paste the whole
   of [`supabase/setup.sql`](supabase/setup.sql) → **Run**. That builds the entire database in one go.
2. **Copy two keys** from *Supabase → Project Settings → API Keys* (the `Project URL` and the
   **Publishable key**, which starts with `sb_publishable_`) into the `.env` file in this folder.
3. **Put it online** — push this folder to a GitHub repository, set *Settings → Pages → Source* to
   **GitHub Actions**, and add those same two keys as repository **variables**
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Pushing to `main` deploys automatically.

Then open the site on your father's Android phone → Chrome ⋮ menu → **Add to Home screen**.
Create your account in the app (the first account becomes the owner), and in
**Settings → Demo data → Load demo data** you can try everything before entering real records.

Want to see it working on this computer first? `npm install` then `npm run dev` — but steps 1 and 2
are still needed, because the app has nowhere to store data without them.

The detailed version of each step is below.

---

## What it answers

1. How much land do we have and what is planted where?
2. Where did the money go, and how much did each crop and each farm cost?
3. How much did we harvest and sell?
4. What is the real profit, profit per acre and ROI?
5. Which farm and which crop performs best, and which gives more money for less work?
6. How does this year compare with last year?

---

## 1. Create the GitHub repository

```bash
git init
git add .
git commit -m "Farm Hisab"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## 2. Create the Supabase project

1. Sign up at <https://supabase.com> and create a **new free project**.
2. Choose a region close to India (for example `ap-south-1` Mumbai).
3. Wait for the project to finish provisioning.

## 3. Run the database migrations

The whole database is reproducible from `supabase/migrations/`. Do **not** create tables by hand
in the Supabase UI.

**Option A — one paste (recommended)**

Open *SQL Editor* in the Supabase dashboard, paste the whole of `supabase/setup.sql` and press
**Run**. That file is generated from the migrations below (`npm run db:bundle`) and is safe to run
more than once.

**Option B — Supabase SQL editor, file by file**

Run each file **in order**:

| Order | File | What it creates |
| --- | --- | --- |
| 1 | `0001_core_schema.sql` | households, profiles, settings, units, seasons, farms, crops, crop allocations, vendors, buyers |
| 2 | `0002_operations_schema.sql` | expenses, expense allocations, activities, irrigation, sprays, fertilizer, seeds, harvests, sales, audit log |
| 3 | `0003_functions_triggers.sql` | signup handling, expense mirroring, auto spray/irrigation numbering, audit triggers |
| 4 | `0004_rls_policies.sql` | Row Level Security policies for every table |
| 5 | `0005_demo_data.sql` | `load_demo_data()` / `remove_demo_data()` functions |

**Option C — Supabase CLI**

```bash
npm install -g supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

## 4. Configure authentication

In *Authentication → Providers*, keep **Email** enabled. Password sign-in is used today; the
auth layer is written so Google sign-in can be added later without changing the rest of the app.

- For a small family account you can turn **Confirm email** off (*Authentication → Sign In / Up*)
  so members can log in immediately.
- Under *Authentication → URL Configuration*, add your GitHub Pages URL to
  **Site URL** and **Redirect URLs**, e.g. `https://<your-user>.github.io/<your-repo>/`.

## 5. Create users

1. Open the deployed app (or `npm run dev`) and choose **Create account**.
   The first person to sign up becomes the **owner/admin** and a new household is created.
2. In the app go to **Settings → Family members** and copy the **family invite code**.
3. Other family members sign up with that invite code, and they join the same household as
   **family members**.

| Action | Owner/Admin | Family member |
| --- | --- | --- |
| Add / edit / delete farms, crops, seasons, crop plans | ✅ | ❌ (view only) |
| Add activities, expenses, irrigation, sprays, seeds, fertilizer | ✅ | ✅ |
| Add harvest and sales | ✅ | ✅ |
| View all reports | ✅ | ✅ |
| Delete financial records | ✅ | own records only |
| Manage users and settings | ✅ | ❌ |

## 6. Environment variables

Copy `.env.example` to `.env` and fill in the two **public** values from your Supabase dashboard:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_<your key>
```

- **Project URL** — *Settings → Data API*, or simply `https://<project-ref>.supabase.co`.
- **Key** — *Settings → API Keys → Publishable key*. This is the browser-safe key that replaces the
  old `anon` key (legacy `anon` keys still work but Supabase deprecates them at the end of 2026).

> ⚠️ Only the **publishable** key belongs in the frontend. A **secret** key (`sb_secret_…` or the
> legacy `service_role`) bypasses Row Level Security and must never be committed or placed in any
> `VITE_` variable. Authorization is enforced by Row Level Security inside PostgreSQL.

## 7. Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint       # ESLint
npm test           # calculation tests
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

## 8. Deploy to GitHub Pages

1. In the repository, go to **Settings → Pages** and set *Source* to **GitHub Actions**.
2. Go to **Settings → Secrets and variables → Actions → Variables** and add two
   **repository variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push to `main`. The `Deploy to GitHub Pages` workflow builds and publishes automatically.

The build never assumes deployment at `/`: the workflow sets `VITE_BASE_PATH` to
`/<repository-name>/` and the app uses hash routing, so deep links keep working on a sub-path.
No paid domain is needed.

## 9. Open and install on Android

1. Open `https://<your-user>.github.io/<your-repo>/` in Chrome on the phone.
2. Tap the ⋮ menu → **Add to Home screen** / **Install app**.
3. The app opens full screen and keeps working when the signal drops.

---

## Offline behaviour

- The app shell and the last data you loaded are cached by the service worker.
- If you save something while offline it is stored in IndexedDB and a banner shows
  *"Offline — changes will sync when internet returns."*
- When the connection returns the queue is replayed and the banner shows *"Synced"*.
- If the server row was changed more recently than your offline edit, the edit is **skipped
  rather than overwriting newer data**, and the conflict is reported. Nothing is deleted silently.

## Backup

**Settings → Backup and export**

- Export as **CSV** (spreadsheet), **Excel** or **PDF** (print-ready)

## Farm Assistant (AI chat)

An in-app chatbot that answers questions using the farmer's **own records** — sowing dates, sprays,
irrigation, fertilizer and harvest — so answers are specific ("your Magfali, sown 62 days ago, has had
no irrigation for 19 days") instead of generic.

It runs as a Supabase Edge Function so the API key never reaches the browser, and every database read
uses the caller's JWT, so Row Level Security still decides what is visible.

**Setup (one time):** run these from the project root.

1. Get a free Gemini API key at <https://aistudio.google.com/apikey>.
2. Log in and link the project (the CLI runs through `npx` — a global install is not supported):
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   The project ref is the first part of your Supabase URL, e.g. `https://abcd1234.supabase.co` → `abcd1234`.
3. Store the key as a secret (never commit it):
   ```bash
   npx supabase secrets set GEMINI_API_KEY=your_key_here
   ```
4. Deploy the function:
   ```bash
   npx supabase functions deploy farm-ai
   ```

Prefer clicking? You can instead create the function and set the secret in the Supabase dashboard under
**Edge Functions** and **Project Settings → Edge Functions → Secrets**.

Until this is done the assistant shows "not set up yet"; the rest of the app is unaffected.

---

## How the money maths works

This is the most important rule in the app:

```
expenses            -> the single source of truth for "how much was spent"
expense_allocations -> how that same money is split across farms and crops
```

Grand totals read `expenses.amount`. Per-farm and per-crop figures read
`expense_allocations.amount`. The two are **never added together**, so a ₹10,000 shared tractor
bill split as ₹4,000 + ₹6,000 still shows a total expense of ₹10,000 — never ₹20,000.

Operational records (spray, irrigation, fertilizer, seed, activity, harvest cost) do not add cost
by themselves. A database trigger mirrors their cost into exactly one linked expense row, so the
Expenses screen always shows the complete picture without duplication.

Nothing about profit is stored. Every figure is calculated on read from expenses, harvests and
sales, so reports update the moment data changes:

```
Net profit      = revenue - allocated cost
Profit per acre = net profit / acres
Yield per acre  = net harvested quintal / acres
ROI %           = (net profit / total cost) x 100     (0 when cost is 0 - never NaN or Infinity)
```

### Farm Performance Score

A balanced 0–100 score built from your own recorded numbers:
40% profit per acre, 30% ROI, 15% low cost per acre, 15% yield per acre.
It is a comparison aid, **not** a scientifically validated metric, and the app says so wherever
the score appears. All report wording is historical ("Based on your recorded data…") and never
promises future results.

---

## Units

Land units are **configurable per household** because a vigha is not the same everywhere.
Defaults ship as acre `1`, vigha `0.3951`, guntha `0.025`, bigha `0.625`, hectare `2.47105`, and
they can be edited in **Settings → Conversion factor**. Weight, volume and time units are
configurable in the same way. Internally everything is normalised to acre / kg / litre / hour.

Currency is formatted with `Intl.NumberFormat('en-IN')`, so amounts read as ₹1,25,000.
Dates are shown as DD/MM/YYYY and stored as proper PostgreSQL `date` / `timestamptz` values with
Asia/Kolkata as the farm timezone.

---

## Project structure

```
src/
  components/      UI kit, layout, charts, shared record screens
  features/        feature hooks (common CRUD, expense allocation, reports)
  hooks/           auth, reference data, preferences, sync status
  i18n/            translation files (en, gu) - no UI text lives in components
  lib/
    calculations/  units, allocation, profit, ranking, filters  <- all business logic
    formatting/    currency, number and date helpers
    validation/    Zod schemas
    supabase/      client and typed CRUD wrapper
    offline/       IndexedDB write queue
    export/        CSV and JSON backup
  pages/           one file per screen
  types/           database row types
supabase/migrations/  reproducible database schema, triggers, RLS and demo data
```

## Tests

`npm test` covers the calculations that decide money:

profit, ROI, profit/cost/revenue per acre, per quintal figures, yield per acre, multiple harvests,
multiple farms and crops, sale deductions, manual/equal/area expense allocation with exact
rounding, shared-expense double counting, season and date filtering, unit conversion, Indian
currency formatting, and zero/empty values never producing `NaN` or `Infinity`.

## Security notes

- Row Level Security is enabled on every application table; nothing is readable without a session.
- Every row is scoped to the signed-in user's household.
- Only the anon public key reaches the browser; there is no service-role key in the frontend.
- Financial records are soft-deleted and every change to expenses, harvests and sales is written
  to `audit_logs` with the user and timestamp.
