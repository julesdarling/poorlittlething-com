# Poor Little Thing

An art showcase for Poor Little Thing. Built as a static Vite site for GitHub Pages, with locally bundled Three.js, GSAP, and Albert Sans fonts.

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

- `public/products.json` contains each piece's title, description, category, colored GLB, assembly STL, and poster image URLs.
- `public/assets/models/` holds the interactive colored GLB models.
- `public/downloads/` holds the complete displayed assembly STL files in millimeters.
- `public/assets/products/` holds fallback poster images.
- `public/assets/toy-world.webp` is the fixed backdrop shared by the live viewers.
- `public/assets/hero.webp` is the supplied hero artwork.
- `public/assets/stacked-logo.svg` preserves the approved stacked brand artwork.
- `index.html` contains the introduction, manifesto, inquiry address, and metadata.
- `src/style.css` defines the layout and brand colors.

The gallery uses one shared WebGL renderer with local canvas copies, avoiding a separate WebGL context for every piece. Models load near the viewport, and GPU resources are released as distant pieces leave the active set. Only the featured model rotates; its camera, lights, and background stay fixed. Auto rotation pauses during direct interaction or when the tab is hidden and starts paused for reduced motion or data saving preferences.

Drag horizontally to turn a model. The turn slider, zoom buttons, and reset control work with keyboard and touch. When a model has keyboard focus, left and right turn it, plus and minus zoom it, and zero resets it. Posters and STL links remain available when WebGL cannot run. STL downloads contain the displayed assembly at its source scale; they are not a prepared print layout. The site has no checkout, visitor accounts, analytics, or form backend.

## Domain

`public/CNAME` binds `poorlittlething.com`. Configure the same custom domain in the repository's Pages settings before changing DNS, then enable HTTPS when the certificate is ready. Preserve existing email MX records when editing website DNS.
