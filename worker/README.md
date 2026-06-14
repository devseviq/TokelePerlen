# Tokleperlen assistant — Cloudflare Worker

Small proxy that lets the site's `/assistent/` page talk to Claude without ever
exposing the API key to the browser. The page sends the chat history + a shared
passphrase; this Worker checks the passphrase, calls the Anthropic API, and
streams the reply back.

```
/assistent/ page  ──POST {messages}──►  this Worker  ──►  api.anthropic.com
   (X-Access-Code)                       (holds key)       (claude-sonnet-4-6)
        ◄──────────── streamed reply (SSE) ────────────
```

## What you need first

1. An **Anthropic API key** — <https://console.anthropic.com> → API keys.
   Add a little prepaid credit. (This is *not* your Claude.ai subscription; it's
   pay-as-you-go, ~cents per conversation.)
2. A **passphrase** to give Siri (any string you choose).
3. The Cloudflare CLI: `npm install` here installs `wrangler` locally.

## Deploy

```powershell
cd worker
npm install
npx wrangler login           # opens browser, one-time
npx wrangler deploy          # publishes the Worker, prints its URL
```

Then set the two secrets (values are prompted, never stored in the repo):

```powershell
npx wrangler secret put ANTHROPIC_API_KEY      # paste the console.anthropic.com key
npx wrangler secret put ASSISTANT_PASSPHRASE   # the code you give Siri
```

## Connect the site to it

Copy the Worker URL printed by `wrangler deploy`
(e.g. `https://tokleperlen-assistant.<your-subdomain>.workers.dev`) into the
site's `hugo.toml` (one level up from this `worker/` folder):

```toml
[params]
  assistantWorkerURL = "https://tokleperlen-assistant.<your-subdomain>.workers.dev"
```

Commit & push — the page goes live at `…/assistent/`. Give Siri that link and
the passphrase.

## Test locally

```powershell
copy .dev.vars.example .dev.vars   # then edit in your real key + passphrase
npm run dev                        # wrangler dev, serves on localhost:8787
```

Point the site's `assistantWorkerURL` at `http://localhost:8787` and run
`hugo server` to try the whole loop.

## Tests (no API key needed)

```powershell
npm test          # node --test — covers auth, CORS, validation, payload shape
```

## Change the model

Either uncomment `[vars] MODEL = "..."` in `wrangler.toml` (then `wrangler deploy`),
or set it as a var. Options: `claude-sonnet-4-6` (default, balanced),
`claude-opus-4-8` (smartest, pricier), `claude-haiku-4-5` (cheapest).

## Notes / guard rails

- Allowed origins are pinned in `src/handler.js` (`ALLOWED_ORIGINS`). Add your
  custom domain there if it changes.
- One conversation is capped (`MAX_MESSAGES`, `MAX_CHARS`) as a basic abuse guard.
- The passphrase gate is light by design (private tool for one person). If you
  ever make this public, switch to Cloudflare Access (free email login) instead.
