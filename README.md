# CBR Laundry Service — deployment guide

A villa laundry request &amp; collection tracker. Static frontend + Cloudflare Pages
Functions + D1, no build step, no Node.js required locally.

- `index.html` — public page: submit a new laundry request (Villa Number, Staff
  Name, Notes, Urgent switch), and a "Track & Collect" tab where a villa looks
  up its own requests and marks them **Collected** once picked up (collector
  name + notes, timestamped).
- `dashboard.html` — mobile dashboard for the laundry manager: shows active
  (**Pending**) requests, urgent ones pinned to the top, with a **Mark Done**
  button (timestamped) plus a secondary tab for what's done but not yet
  collected. Not linked from the public page — bookmark it directly.
- `functions/api/` — Cloudflare Pages Functions backed by D1 (`requests`
  table). No secrets involved, so no environment variables to configure.

Status flow: `Pending → Done → Collected`.

## One-time setup

### 1. Push this repo to GitHub

```bash
git remote add origin https://github.com/<your-username>/cbr-laundry.git
git add -A
git commit -m "Initial commit"
git push -u origin main
```

(Create the empty repo on GitHub first, at github.com/new. Private is fine —
there are no secrets in this project.)

### 2. Create a D1 database

In the Cloudflare dashboard: **Workers & Pages → D1 → Create database**. Name
it e.g. `cbr-laundry-db`.

Open its **Console** tab and paste in the contents of [`schema.sql`](schema.sql),
then run it. That creates the `requests` table.

### 3. Create the Pages project

1. **Workers & Pages → Create → Pages → Connect to Git.**
2. Pick this GitHub repo. Build settings: leave everything default (static
   files + Functions, both auto-detected, no build command).
3. Project name: `cbr-laundry` (this becomes `cbr-laundry.pages.dev`).
4. Deploy.

### 4. Bind the D1 database to the Pages project

**Pages project → Settings → Bindings → Add → D1 database.**

- Variable name: `DB` (must match exactly — the code reads `env.DB`)
- D1 database: the one created in step 2

Apply to both Production and Preview, then **redeploy** (bindings only take
effect on the next deployment).

## Using it

- Share the root URL (`https://cbr-laundry.pages.dev/`) with villa staff for
  submitting and collecting requests.
- Give the laundry manager `https://cbr-laundry.pages.dev/dashboard.html`
  directly (e.g. as a home-screen shortcut on their phone) — it isn't linked
  from the public page.

There's no login on either page in this version — anyone with the dashboard
link can mark requests Done. If you want it restricted to specific staff,
Cloudflare Access (**Zero Trust → Access → Applications**, free for up to 50
users) can gate `dashboard.html` by email the same way it's used in the
Print Request Dashboard project.

## Going forward

Any future change: edit the code, `git push`, and Cloudflare redeploys
automatically in under a minute.

## Local testing

This machine has no Node.js, so `functions/api/*` can't be run locally via
`wrangler pages dev`. Opening `index.html`/`dashboard.html` directly will
render the layout but every API call will fail (no backend to talk to) —
that's expected. Use Cloudflare's preview deployments (every push gets one)
to test end-to-end.
