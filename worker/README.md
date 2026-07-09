# Daily brief trigger — Cloudflare Worker

Holds a GitHub token securely server-side so the dashboard's "오늘의 브리프 생성" (create today's brief) button can trigger the `daily-brief.yml` GitHub Actions workflow with a real one-click experience, without that token ever touching the browser.

## What you need to do (I can't do these steps for you — they require your own Cloudflare/GitHub accounts)

### 1. Create a scoped GitHub token
GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token.
- Repository access: **Only select repositories** → this repo only.
- Permissions: **Actions: Read and write**. Nothing else.
- Copy the token — you'll paste it into `wrangler secret put` in step 3, not anywhere in this repo.

### 2. Install and log into Wrangler (Cloudflare's CLI)
Requires a free Cloudflare account.
```
npm install -g wrangler
wrangler login
```

### 3. Set the two secrets and deploy
From this `worker/` directory:
```
wrangler secret put GITHUB_TOKEN
# paste the token from step 1 when prompted

wrangler secret put TRIGGER_SECRET
# paste: ePT5yrvegjDhSdH8wQSttcQmySJDzJ2Q
# (this must match the TRIGGER_SECRET in js/daily-brief-trigger.js exactly)

wrangler deploy
```
Wrangler prints the deployed Worker URL (something like `https://market-dashboard-brief-trigger.<your-subdomain>.workers.dev`).

### 4. Point the dashboard at your deployed Worker
Edit `js/daily-brief-trigger.js` in the repo root and set `WORKER_URL` to the URL from step 3. Commit and push.

### 5. (Optional, tighter CORS) 
Edit `[vars] ALLOWED_ORIGIN` in `wrangler.toml` to your actual GitHub Pages origin (e.g. `https://rayenc616.github.io`) instead of `*`, then `wrangler deploy` again.

## What this does and doesn't protect

- The GitHub token never leaves the Worker — the browser only ever holds `TRIGGER_SECRET`, which can only cause this one Worker to dispatch this one workflow. It cannot read/write your repo or do anything else, unlike a raw token would.
- `TRIGGER_SECRET` itself is still visible in the dashboard's page source (same caveat as the login passwords elsewhere in this project) — anyone who finds it could trigger extra (paid) Claude API runs by spamming the button. There's no rate limiting here; add some in the Worker if that becomes a problem.
