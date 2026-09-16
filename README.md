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
