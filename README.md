# ICB — International Church of Batam

Website for International Church of Batam (ICB), Batam, Riau Islands, Indonesia.

**Live site:** deploy via [Netlify](https://netlify.com)

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Main homepage |
| `connect.html` | Connect subpage (groups, contact form) |
| `style.css` | All styles and animations |
| `script.js` | Site interactions + Three.js Bible animation |
| `icb-logo.png` | ICB logo (transparent PNG) |
| `batam_google_earth_zoom.mp4` | Hero background video |

---

## Deploy to Netlify

1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Connect your GitHub account and select this repository
4. Build settings — leave everything blank (no build command needed)
5. Click **Deploy site**

Netlify will publish the site instantly. Future changes: commit and push to GitHub and Netlify redeploys automatically.

---

## Updating the site

All content edits are made in these files:

- **Text / sections** → `index.html` or `connect.html`
- **Colors / fonts / layout** → `style.css`
- **Bible animation / interactions** → `script.js`
- **Add photos** → drop image files in the root folder, reference them in `index.html` as `src="your-photo.jpg"`

---

## Adding photos later

When you have real ICB photos:
1. Add the image file to this folder (e.g. `icb-community.jpg`)
2. In `index.html`, find the card or section you want and add: `<img src="icb-community.jpg" alt="ICB Community"/>`
3. Commit and push — Netlify updates automatically

---

*A Blessing to All Nations — Genesis 12:3*
