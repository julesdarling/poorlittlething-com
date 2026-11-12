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

- `public/products.json` contains each piece's title, category, colored GLB, assembly STL, and poster image URLs.
- `public/assets/models/` holds the interactive colored GLB models.
- `public/downloads/` holds the complete displayed assembly STL files in millimeters.
- `public/assets/products/` holds fallback poster images.
- `public/assets/backgrounds/` holds three coordinated toy-world backdrops, assigned per piece.
- `public/assets/hero.webp` is the supplied hero artwork.
- `public/assets/stacked-logo.svg` preserves the approved stacked brand artwork.
- `index.html` contains the introduction, manifesto, inquiry address, and metadata.
- `src/style.css` defines the layout and brand colors.

The gallery uses one shared WebGL renderer with local canvas copies, avoiding a separate WebGL context for every piece. Models load near the viewport, and GPU resources are released as distant pieces leave the active set. Only the featured model rotates; its camera, lights, and background stay fixed. Models stay still at rest and respond to pointer movement. Reduced motion preferences remove the short interpolation between pointer positions.

Palm Star and Palm Heart use measured `rotationPivot` coordinates around their base and handle axes. Their default poses stay unchanged, and the viewer fits the full swept radius to keep the pieces inside the frame.

Move the mouse across a model to turn it through 180°. On touch, swipe horizontally; vertical page scrolling remains available. Each model exposes an accessible horizontal slider with its actual angle from −90° to +90°. When it has keyboard focus, Left and Right turn it, Home selects −90°, End selects +90°, and zero resets it. Screen readers receive the current rendered angle. Image fallbacks expose a non-focusable preview instead of slider controls. There are no visible rotation controls. Posters and STL links remain available when WebGL cannot run. STL downloads contain the displayed assembly at its source scale; they are not a prepared print layout. The site has no checkout, visitor accounts, analytics, or form backend.

## Domain

`public/CNAME` binds `poorlittlething.com`. Configure the same custom domain in the repository's Pages settings before changing DNS, then enable HTTPS when the certificate is ready. Preserve existing email MX records when editing website DNS.
