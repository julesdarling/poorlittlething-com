# Poor Little Thing

An art showcase for Poor Little Thing. Built as a static Vite site for GitHub Pages, with locally bundled GSAP and Albert Sans fonts.

## Development

```sh
npm ci
npm run dev
```

The local preview runs at `http://127.0.0.1:4173/`.

```sh
npm run build
```

The production website is generated in `dist/`. The GitHub Actions workflow builds and deploys that directory when `main` changes.

## Content

- `public/products.json` contains the collection titles, descriptions, categories, and four image URLs for each piece.
- `public/assets/products/` holds four real rendered views per piece across a 180° sweep.
- `public/assets/hero.webp` is the supplied hero artwork.
- `public/assets/stacked-logo.svg` preserves the approved stacked brand artwork.
- `index.html` contains the introduction, manifesto, inquiry address, and metadata.
- `src/style.css` defines the layout and brand colors.

Product rotation runs only near the viewport, pauses during direct interaction or when the tab is hidden, and starts paused for reduced motion or data saving preferences. Every piece also has keyboard and touch view controls. The site has no checkout, visitor accounts, analytics, or form backend.

## Domain

`public/CNAME` binds `poorlittlething.com`. Configure the same custom domain in the repository's Pages settings before changing DNS, then enable HTTPS when the certificate is ready. Preserve existing email MX records when editing website DNS.
