# NO*Tokleperlen — website

Static site built with **Hugo**, with **Sveltia CMS** layered on top so Siri can add
kittens/litters and edit pages without touching code. Deploys to **GitHub Pages** via
GitHub Actions. Content is in Norwegian; code/docs are in English.

Repo: `devseviq/TokelePerlen` · push from your `devseviq` account.

> **Current state (2026-06-21):** live on the custom domain **`https://www.tokleperlen.com`**
> (GitHub Pages, HTTPS enforced); `https://tokleperlen.com` and
> `https://devseviq.github.io/TokelePerlen/` redirect to it. The old Webnode site is
> still live and indexed on `tokleperlen.no` — the `.no` cutover is on hold pending Siri.
> Old intake pages (`/innspill/`, `/last-opp/`, `/assistent/`) now redirect to the
> Siri portal at `https://siri.sevnet.net/work/tokleperlen`.
> Planned: this repo moves into the `tokle` GitHub org (a deliberate, watched step so the
> custom domain doesn't drop). See `../TOKLE-FAMILY-EVAL-AND-EXPANSION-2026-06-21.md`.
> The "Fast DNS-only staging" section below is the rehearsal that produced this live state.

---

## Stack at a glance

| Piece | What it does |
|---|---|
| Hugo | Generates the static site from Markdown in `content/` |
| Sveltia CMS (`/admin/`) | Decap-compatible web editor for Siri |
| Cloudflare Worker (`sveltia-cms-auth`) | "Log in with GitHub" for the CMS |
| GitHub Pages + Actions | Hosting + automatic build on every push |

## Repo layout

```
content/        Page text + kittens (Markdown). This is what Siri edits.
layouts/        Templates (sidebar nav, hero, page, kitten cards).
static/css/     main.css — the theme (dark sidebar + gold, photo-led).
static/admin/   Sveltia CMS (index.html + config.yml).
static/images/  Site images (page heroes etc.).
.github/workflows/deploy.yml   Build + deploy to Pages.
hugo.toml       Config + navigation menu.
```

---

## Local development

Install Hugo **extended** (Windows):

```powershell
winget install Hugo.Hugo.Extended
```

Then, from the repo root:

```powershell
hugo server
```

Open <http://localhost:1313>. Edits to `content/`, `layouts/`, or `static/css/main.css`
hot-reload. `rg` tip: `hugo server --navigateToChanged` jumps the browser to the page you just saved.

---

## Deploy (already wired up)

1. On GitHub: **Settings → Pages → Build and deployment → Source = "GitHub Actions"** (one-time).
2. Push to `main`. `deploy.yml` builds Hugo and publishes.
3. Site goes live at `https://devseviq.github.io/TokelePerlen/` until you attach a custom domain.

The workflow sets Hugo's `baseURL` automatically from what Pages reports, so you do **not**
need to edit `hugo.toml` when the custom domain is attached.

---

## Fast DNS-only staging on tokleperlen.com

If you only want to test a real custom domain without moving registrar/DNS
ownership yet, point `.com` records straight at GitHub Pages from Webnode. `.com`
is the secondary domain, so the live `.no` site stays untouched on Webnode during
this rehearsal.

1. Repo **Settings → Pages → Custom domain** → enter `www.tokleperlen.com`.
   With the current GitHub Actions Pages workflow, GitHub stores the custom
   domain setting; no `CNAME` file is required.
2. In Webnode **Manage DNS** for `tokleperlen.com`:
   - `www` → CNAME → `devseviq.github.io`
   - apex `@` → A records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. Wait for DNS to propagate; GitHub issues a Let's Encrypt cert. Tick **Enforce HTTPS** once it's available.

For the real move off Webnode, use Cloudflare DNS instead. See the root workspace
note `ops/tokleperlen-com-webnode-move-evaluation.md`.

---

## CMS login (one-time setup, so Siri can edit)

The CMS commits to GitHub on the editor's behalf, which needs a GitHub OAuth helper. We use the
official Cloudflare Worker. Steps:

**A. Add Siri as a collaborator** — repo **Settings → Collaborators**. Her saves then commit as her.

**B. Deploy the auth Worker** — <https://github.com/sveltia/sveltia-cms-auth>
Use the "Deploy to Cloudflare" button, or clone it and run `npx wrangler deploy`.
Note the URL: `https://sveltia-cms-auth.<your-subdomain>.workers.dev`

**C. Register a GitHub OAuth App** — github.com → **Settings → Developer settings → OAuth Apps → New**:
   - Homepage URL: your site (e.g. `https://www.tokleperlen.com`)
   - Authorization callback URL: `https://sveltia-cms-auth.<your-subdomain>.workers.dev/callback`
   - Generate a client secret.

**D. Add the credentials to the Worker** — Cloudflare dashboard → the `sveltia-cms-auth` service →
**Settings → Variables**:
   - `GITHUB_CLIENT_ID` = client id
   - `GITHUB_CLIENT_SECRET` = client secret
   - *(optional)* `ALLOWED_DOMAINS` = `tokleperlen.com,www.tokleperlen.com,devseviq.github.io`

**E. Point the CMS at the Worker** — in `static/admin/config.yml`, set `backend.base_url` to your
Worker URL. Commit & push.

**F. Done.** Siri opens `…/admin/`, clicks **Log in with GitHub**, edits, and saves. Each save is a
git commit, which triggers an automatic redeploy.

> Note: GitHub's client-side PKCE login (which would remove the Worker entirely) is announced but
> **not released yet**, so the Worker is the current approach. If anything below drifts, the
> `sveltia-cms-auth` README is the source of truth.

---

## What Siri can edit (in `/admin/`)

- **Sider** — the text of each fixed page (forside, om oppdrettet, om rasen, kontakt, prisliste, venteliste, kattehotell, utstyrsliste, planlagt kull).
- **Kattunger / kull** — add a litter or kitten: name, date, **status** (Ledig / Reservert / Solgt / Beholdes), ID, photo, description. Each becomes a card on the Kattunger page.
- **Avlskatter** — the breeding cats.

---

## To do

- **Contact details** — add email + Facebook link in `content/kontakt.md` (placeholder marked `TODO`).
- **Prisliste** — fill in step 3 and any remaining text (`content/prisliste.md`).
- **Images** — see below.

### Images

The old site's photos aren't bundled here (they couldn't be pulled into the scaffold automatically).
Either:
- download the originals from the live site and drop them in (`static/images/` for page images;
  inside the kull's folder for kitten photos), **or**
- let Siri upload fresh photos through `/admin/` — which is how it'll work going forward anyway.

---

## Migration sequence (big picture)

1. **Build & review** here, on the `github.io` URL.
2. **Dress-rehearse on `tokleperlen.com`** (section above). Live `.no` stays on Webnode.
3. When happy, **move `tokleperlen.no`** to a Norwegian registrar that allows custom nameservers
   (e.g. Domeneshop) → Cloudflare DNS → point at Pages. *Cloudflare Registrar does not support `.no`,
   so the registration itself can't live there — only its DNS moves to Cloudflare.* Optionally move
   `.com` onto Cloudflare too.
4. **Only after** `.no` serves the new site and DNS has propagated: cancel the Webnode subscription.
   Don't recreate the old Webnode email MX record — Siri doesn't use that mailbox.
