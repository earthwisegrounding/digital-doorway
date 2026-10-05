# Digital Doorway Marketing website

Live at https://digitaldoorwaymarketing.com (GitHub Pages, publishing the `docs/` folder only; custom domain via `docs/CNAME`).

Static site, no build step. Everything the public sees lives in `docs/`; the rest of the repo (this README, `api/`, `.claude/`) is not published.

- `docs/index.html` — the page (includes the JSON-LD structured data in the `<head>`)
- `docs/styles.css` — all styling, including the self-hosted `@font-face` rules
- `docs/script.js` — nav, scroll reveals, FAQ, forms, comparison slider, order builder, and the on-demand loader for the 3D section
- `docs/showpiece.js` — the scroll-driven 3D doorway (Three.js r128 from cdnjs). It is loaded by `script.js` only after the first scroll or when the section is on screen, so it never slows the initial page load.
- `docs/assets/door.glb` — the scanned front door used in that section (~1.5 MB; fetched by `showpiece.js` after it loads)
- `docs/assets/fonts/` — self-hosted Fraunces (normal + italic) and Inter Tight, latin subset, variable
- `docs/assets/logo-53.png`, `logo-106.png`, `logo-159.png` — the header logo at 1x/2x/3x; `logo.png` is the full-size original (used in structured data)
- `docs/assets/og-image.jpg` — 1200×630 share image for link previews
- `docs/favicon.ico`, `docs/assets/icon-*.png`, `docs/assets/apple-touch-icon.png` — icons
- `docs/robots.txt`, `docs/sitemap.xml`, `docs/llms.txt`, `docs/404.html` — crawler files and the not-found page
- `docs/assets/marv.mp3` — the founder's voice note (player currently removed from the page)
- `api/` — the Cloudflare Worker for form emails and order requests (deployed separately with wrangler; see below)

## Preview locally

```bash
python3 -m http.server 8767 --directory docs
```

Then open http://localhost:8767

## SEO upkeep

- Title, meta description, Open Graph/Twitter tags, and the JSON-LD graph are all in the `<head>` of `docs/index.html`. If prices or offerings change, update the page copy, the JSON-LD offers, `docs/llms.txt`, and the order builder together.
- Bump `<lastmod>` in `docs/sitemap.xml` after meaningful homepage changes.
- The full audit and action plan (`FULL-AUDIT-REPORT.md`, `ACTION-PLAN.md`) are kept locally and are git-ignored so they aren't published.

## Deploy

Commit and push to `main`; GitHub Pages rebuilds from `docs/` in about a minute.

## Payments (Square)

- Every payment button (homepage `#checkout` and `/ready`) POSTs to the worker's `/checkout`, which creates a Square checkout and redirects to it. No fixed payment link is used anymore.
- Payments go to the Digital Doorway Marketing Square account (its own account, separate from justlikegrounding.com), location "Digital Doorway Marketing", ID `L3QWTE4CRSP7G` (`SQUARE_LOCATION_ID` in `api/wrangler.toml`). Switched from the justlikegrounding account (location `LWTA04YK02TTT`) on 2026-10-04.
- The worker's `SQUARE_ACCESS_TOKEN` secret is that account's production access token (from developer.squareup.com). Set it with `cd api && npx wrangler secret put SQUARE_ACCESS_TOKEN`; it is never in the repo.
- After paying, customers land on `docs/thank-you.html`. Square emails the receipt.

## Contact form emails (Resend via Cloudflare Worker)

- Submissions POST to `https://digital-doorway-mail.angie-tatum-api.workers.dev/contact` (source in `api/`), which emails them through Resend with reply-to set to the visitor.
- Recipients and sender are set in `api/wrangler.toml` (`NOTIFY_TO`, `MAIL_FROM`). The Resend API key is a Worker secret (`cd api && echo "re_…" | npx wrangler secret put RESEND_API_KEY`), never in the repo.
- Until digitaldoorwaymarketing.com is verified in Resend, Resend only delivers to the account's own address; after verifying, set `NOTIFY_TO` to all three addresses, `MAIL_FROM` to an address on the domain, optionally `AUTO_REPLY = "yes"`, then `cd api && npx wrangler deploy`.
- A hidden `website` field is a honeypot; submissions that fill it are accepted but not sent.

## Sale emails (Square webhook → Resend)

- Square webhook subscription "Digital Doorway Marketing sales" (`payment.updated`) posts to the worker's `/square-webhook`. The worker verifies Square's signature, ignores payments from other locations and duplicate deliveries (KV namespace `SEEN`), then emails the admins (`NOTIFY_TO`) a sale alert and the buyer a thank-you.
- Secret: `SQUARE_WEBHOOK_SIGNATURE_KEY` (from the subscription, `npx wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY`).

## Client work: Pro Lawn Care (two directions)

- `docs/work/prolawn/` (Direction A) and `docs/work/prolawn/b/` (Direction B) are copies of the two ProLawn builds from `~/Documents/landscaping/prolawn` (repo verdura). Photos recompressed; unused camera originals left out. Both pages carry `noindex` so they don't compete with the client's own site in search.
- Their "Design your yard in 3D" links point to the live studio at earthwisegrounding.github.io/verdura (its 3D models are ~59 MB, so it is not copied). Inside the comparison, the studio and any other link that leaves the page open in a new tab; if a frame ever navigates away anyway, a "Back to the comparison" button reloads both and re-syncs.
- The homepage "One business. Two directions." section loads both in stacked frames with a draggable divider; because they're on the same domain, scrolling either side scrolls both in step, and only one welcome message plays at a time.
- If the ProLawn sites change, re-copy them into `docs/work/prolawn/` (keep the noindex tag and the studio links).

## Orders and online payment (Square)

- The `#checkout` section ("Claim your website") charges exactly $499. The $499 includes the website plus the first 2 years of 7 services: hosting, domain registration, SSL security, 5 business email addresses, local SEO, QR code generation, and a professional audio welcome message, with no monthly fees for 24 months (same as `/ready`). "Continue to secure payment" POSTs `{items: ["build"]}` and an optional receipt email to the worker's `/checkout`, which creates a Square payment link for the order under the "Digital Doorway Marketing" location and redirects to Square's checkout. Afterward customers land on `docs/thank-you.html`.
- The "After your first two years" section (`#addons`) lists what applies from month 25: the optional Business Bundle ($34.99/month; domain, hosting, SSL, 5 emails, local SEO, QR codes, audio welcome message, matching `/ready`) or individual hosting ($14.99/month), SSL ($5.99/month), and email ($59/$129/$199 a year). Nothing from it is sold at checkout today. The worker's `CATALOG` still knows those items if they're ever sold online.
- `/ready` and the homepage must describe the same offer. If the included services or the bundle change, update both pages, the JSON-LD, `docs/llms.txt`, and the worker's item names.
- The Square webhook subscription "Digital Doorway Marketing sales" is enabled, so every completed payment sends the admins a "New sale" email and the customer a thank-you.
- Switches: `CHECKOUT_ENABLED` in `api/wrangler.toml` ("yes" now). If checkout can't open, both pages ask the visitor to try again or call (877) 853-1920.
- The Square location must be **Active** for any of this to work. On 2026-10-04 it had been set to Inactive (Square showed "This business is currently not accepting payments") and was reactivated through the API.
- `/order-request` (the old invoice flow) still exists in the worker but nothing on the site calls it.
- If you change a price, change it in `CATALOG` (worker) AND the display prices in `docs/index.html` + the `P` table in the order-builder block of `docs/script.js`, and the JSON-LD offers and `docs/llms.txt`.
