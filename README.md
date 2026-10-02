# Dev Hub

My personal site: interview Q&A, resumes, and a few projects, all in one installable app that works offline.

**Live site:** https://mmdreza21.github.io/

## What's inside

| Page | File | What it is |
| --- | --- | --- |
| Landing page | `landing.html` | The start page. Links to everything, with search and filters. |
| Full-stack resume | `index.html` | My full-stack developer resume (Vue, Nuxt, React, Node.js, NestJS). |
| Persian resume | `indexFa.html` | Resume in Persian. |
| Game developer resume | `Game.html` | My game development resume. |
| All Q&A | `qa.html` | Every interview question in one page. |
| Backend Q&A | `backend-qa.html` | Node.js, NestJS, databases, auth. |
| Frontend Q&A | `frontend-qa.html` | JavaScript, TypeScript, Vue, Nuxt, Next, React. |
| DevOps Q&A | `devops-qa.html` | Docker, Git, REST, security. |
| Solar System cheat sheet | `solar_system_dark.html` | A dark-mode quick-reference sheet. |

## Install it as an app

The site is a Progressive Web App (PWA). Open the landing page in Chrome or Edge and press **Install app**, or use the browser's install button in the address bar. On iOS, use Share, then **Add to Home Screen**.

After the first visit, the main pages are cached, so they open without internet. The installed app starts on `landing.html`.

## Project structure

```
.
├── landing.html            # PWA start page
├── index.html              # Full-stack resume
├── indexFa.html            # Persian resume
├── Game.html               # Game developer resume
├── qa.html                 # All interview Q&A
├── backend-qa.html
├── frontend-qa.html
├── devops-qa.html
├── solar_system_dark.html
├── manifest.json           # PWA manifest (start_url: landing.html)
├── sw.js                   # Service worker (offline cache)
├── favicon.ico
├── icons/                  # icon-192.png and icon-512.png (required for install)
├── assets/                 # CSS and images
└── TemplateData/           # Unity WebGL files used by the game page
```

## Run it locally

Service workers need a web server. Opening the files directly (`file://`) will not register the PWA.

```bash
# Python
python -m http.server 8080

# or Node
npx serve .
```

Then open http://localhost:8080/landing.html.

## Deploy

The site is static, so it works on GitHub Pages, Netlify or Vercel with no build step. For GitHub Pages: push to the repository and enable Pages from the main branch root.

## Add a new page

1. Create the HTML file in the project root.
2. Add a card to `landing.html` inside `<main class="bento">`. Copy an existing `<a class="tile ...">` block.
3. Add the file to the `CORE` list in `sw.js`.
4. Change the `CACHE` name in `sw.js` (for example `mmdreza-hub-v3`) so devices download the update.

## Updating the installed app

Installed apps keep the old cache and `start_url` until the service worker changes. After a deploy:

1. Bump `CACHE` in `sw.js`.
2. Hard refresh the site (Ctrl+Shift+R).
3. If the install icon or start page still looks old, uninstall the app and install it again.

## Troubleshooting

- **No install button:** check that `icons/icon-192.png` and `icons/icon-512.png` exist, and that the site is served over HTTPS (or localhost).
- **Offline mode not working:** open DevTools, then Application, then Service Workers, and check that `sw.js` is activated. Look at the console for `SW skip:` warnings about missing files.
- **Old content after an update:** bump `CACHE` in `sw.js` and hard refresh.

## Contact

Mohammad Reza Javadi, full-stack developer

- GitHub: https://github.com/mmdreza21
- LinkedIn: https://linkedin.com/in/mamadreza1998
- Portfolio: https://mmdreza21.github.io/
