# Digital Doorway Marketing website

Static site, no build step. Files:

- `index.html` — the page
- `styles.css` — all styling
- `script.js` — nav, scroll reveals, FAQ accordion, contact form validation

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
