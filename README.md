# Digital Doorway Marketing website

Live at https://digitaldoorwaymarketing.com (GitHub Pages, custom domain via the CNAME file).

Static site, no build step. Files:

- `index.html` — the page
- `styles.css` — all styling
- `script.js` — nav, scroll reveals, FAQ accordion, contact form validation
- `showpiece.js` — the scroll-driven 3D doorway section (uses Three.js r128 from cdnjs; falls back to a static frame under reduced motion and to a plain gradient without WebGL)
- `assets/marv.mp3` — the founder's voice note, played by the custom player in the "Who's behind the door" section
- `assets/door.glb` — the scanned front door used in that section (2 MB, loaded only when the section is near). It is a single mesh, so the script splits leaf from frame with GPU clipping planes and hinges the leaf on the left.

## Preview locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765

## Before launch

1. Search the files for `REPLACE` and put in your real email and phone.
2. Contact form: it currently shows a success message without sending. Look for the commented endpoint line in `script.js` / the `<form>` in `index.html` and paste in a Formspree or Netlify Forms endpoint.

## Deploy

Drag the folder onto Netlify Drop, or push to GitHub and enable GitHub Pages, or use Cloudflare Pages. Any static host works.

## Payments (Square)

- The "Pay $499 with Square" button in the pricing panel opens a Square payment link: https://square.link/u/K1iD7cfg
- It lives under the Square location "Digital Doorway Marketing" (ID LWTA04YK02TTT) on the same Square account as justlikegrounding.com. Payments show up in the Square Dashboard under that location; filter by it to keep the two businesses separate.
- After paying, customers land on `thank-you.html`. Square emails the receipt.
- To change the price or wording, edit the link in Square Dashboard → Online → Payment links (or create a new one and update the button's href in `index.html`). No code holds any secret; the access token stays in the angie project's `api/.env`.

## Contact form emails (Resend via Cloudflare Worker)

- Submissions POST to `https://digital-doorway-mail.angie-tatum-api.workers.dev/contact` (source in `api/`), which emails them through Resend with reply-to set to the visitor.
- Recipients and sender are set in `api/wrangler.toml` (`NOTIFY_TO`, `MAIL_FROM`). The Resend API key is a Worker secret (`cd api && echo "re_…" | npx wrangler secret put RESEND_API_KEY`), never in the repo.
- Until digitaldoorwaymarketing.com is verified in Resend, Resend only delivers to the account's own address; after verifying, set `NOTIFY_TO` to all three addresses, `MAIL_FROM` to an address on the domain, optionally `AUTO_REPLY = "yes"`, then `cd api && npx wrangler deploy`.
- A hidden `website` field is a honeypot; submissions that fill it are accepted but not sent.

## Sale emails (Square webhook → Resend)

- Square webhook subscription "Digital Doorway Marketing sales" (`payment.updated`) posts to the worker's `/square-webhook`. The worker verifies Square's signature, ignores payments from other locations and duplicate deliveries (KV namespace `SEEN`), then emails the admins (`NOTIFY_TO`) a sale alert and the buyer a thank-you.
- Secret: `SQUARE_WEBHOOK_SIGNATURE_KEY` (from the subscription, `npx wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY`).

## Client work: Pro Lawn Care (two directions)

- `work/prolawn/` (Direction A) and `work/prolawn/b/` (Direction B) are copies of the two ProLawn builds from `~/Documents/landscaping/prolawn` (repo verdura). Photos recompressed; unused camera originals left out. Both pages carry `noindex` so they don't compete with the client's own site in search.
- Their "Design your yard in 3D" links point to the live studio at earthwisegrounding.github.io/verdura (its 3D models are ~59 MB, so it is not copied). Inside the comparison, the studio and any other link that leaves the page open in a new tab; if a frame ever navigates away anyway, a "Back to the comparison" button reloads both and re-syncs.
- The homepage "One business. Two directions." section loads both in stacked frames with a draggable divider; because they're on the same domain, scrolling either side scrolls both in step, and only one welcome message plays at a time.
- If the ProLawn sites change, re-copy them into `work/prolawn/` (keep the noindex tag and the studio links).

## Orders and invoices (online payment switched off)

- The `#checkout` section is an order builder: the $499 build (which includes the first 2 years of hosting and domain registration) is always included, and customers add SSL, the Small Business Bundle, or an email plan. "Request my invoice" POSTs name, business, email, and items to the worker's `/order-request`, which prices the order from `CATALOG` in `api/worker.js` and emails the admins an itemized "Order to invoice" plus a copy to the customer. Nothing is charged on the site; you send the invoice.
- Square online payment is kept but OFF: `PAY_ONLINE = false` in `script.js`, `CHECKOUT_ENABLED = "no"` in `api/wrangler.toml` (the `/checkout` route returns 403), and the Square webhook subscription "Digital Doorway Marketing sales" is disabled in Square. To turn online payment back on, flip both flags, redeploy the worker (`cd api && npx wrangler deploy`), and re-enable the webhook.
- The original $499 Square payment link (square.link/u/K1iD7cfg) still exists in Square but is not linked from the site.
- If you change a price, change it in `CATALOG` (worker) AND the display prices in `index.html` + the `P` table in the order-builder block of `script.js`.
