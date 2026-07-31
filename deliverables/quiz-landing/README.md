# Phantom Bio Peptides — Standalone Quiz Landing Page

Single-file lead-capture quiz. Zero build step, zero dependencies, no
environment variables.

## What it does

- Renders a 5-question research quiz styled to match `phantombiopeptides.com`.
- Captures the lead as soon as contact info is validated (so people who
  abandon are still counted).
- On completion, POSTs the answers + consent and shows an inline
  **Download the guide now** button.
- All lead data is written to WordPress via the storefront's own
  `/api/quiz-lead` endpoint — no secrets in this file.

## Deploy on Vercel

### Option 1 — Vercel dashboard drag-and-drop (fastest)

1. Log into <https://vercel.com>.
2. **Add New → Project → Upload Templates → Deploy**, or from the CLI:
   ```bash
   npx vercel deploy --prod
   ```
   from this directory.
3. Vercel serves `index.html` at the project root. Done.

### Option 2 — Vercel CLI (fresh project)

```bash
cd deliverables/quiz-landing
npx vercel@latest link       # answers: create new, name it "phantom-quiz"
npx vercel@latest --prod     # deploys
```

Vercel auto-detects it as a static site, no framework config needed.

### Option 3 — GitHub → Vercel auto-deploy

1. Push the `deliverables/quiz-landing/` folder to its own GitHub repo.
2. In Vercel, **Add New → Project → Import** from that repo.
3. Framework preset: **Other**. Root directory: `/`. Build command:
   *(leave blank)*. Output directory: *(leave blank)*.
4. Deploy.

## Custom domain (optional)

Vercel dashboard → project → **Settings → Domains** → **Add**.
Common patterns:

- `quiz.phantombiopeptides.com` (subdomain — no DNS change needed if
  the parent domain is on Vercel or Cloudflare)
- `phantomquiz.com` (dedicated ad landing domain)

## No environment variables needed

The quiz posts to `https://www.phantombiopeptides.com/api/quiz-lead`
(hardcoded near the top of `<script>`). CORS is wide open on that
endpoint — this page can live on any domain and still capture leads.

If you ever change the hostname the API lives on, edit `LEAD_ENDPOINT`
in `index.html`.

## Verify after deploy

1. Open the Vercel deployment URL.
2. Fill contact info → click **Start the quiz**.
3. Within ~5 seconds, the lead should appear at
   `phantombiopeptides.com/wp-admin` → **Tools → Phantom Quiz Leads**
   with stage `started`.
4. Walk to the end, check consent, click **Send my guide**.
5. Same row updates to stage `completed`. The done screen shows a
   **Download the guide now** button. An email arrives with the PDF
   link (delivery may take a minute).

## Notes

- Fire-and-forget: the quiz never blocks on the network. If WordPress
  is down or slow, the user experience is unaffected.
- Guide PDF URL is configured on the WordPress side, not in this file
  — WP admin → **Settings → Phantom Accounts → Quiz Guide PDF URL**.
- UTM parameters (`?utm_source=…&utm_medium=…&utm_campaign=…`) are
  read from the URL and recorded on the lead automatically.
- To retheme, all CSS is in the `<style>` block. All copy is in the
  `QUESTIONS` array near the top of the `<script>`.
