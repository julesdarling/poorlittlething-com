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
- `public/downloads/poor-little-thing-full-stl-collection.zip` bundles all 18 assembly STLs and a short README for the header download.
- `public/assets/products/` holds transparent fallback poster images.
- `public/assets/backgrounds/` holds nine supplied flat backdrops, each assigned to two pieces with varied rows and filtered lists.
- `public/assets/hero.webp` is the supplied hero artwork.
- `public/assets/stacked-logo.svg` preserves the approved stacked brand artwork.
- `index.html` contains the introduction, manifesto, inquiry address, and metadata.
- `src/style.css` defines the layout and brand colors.

The gallery uses one shared WebGL renderer with local canvas copies, avoiding a separate WebGL context for every piece. Models load near the viewport, and GPU resources are released as distant pieces leave the active set. Only the featured model rotates; its camera, lights, and background stay fixed. Models rotate slowly until the mouse enters, follow pointer movement while hovered, and resume slow rotation when the mouse leaves. Reduced motion preferences disable automatic rotation and pointer interpolation.

After changing catalogue STL files, rebuild the full archive with `python3 scripts/package-stls.py --verify-rebuild` and update the header download's cache version to the new archive hash. The script verifies every member against the source STL and uses fixed archive metadata.

The toys float in front of the flat backdrops. A shared soft shadow layer uses the warm taupe sampled from the supplied images and appears beneath both the poster and live model. Six pieces that were modeled lying down use explicit upright presentation rotations. Palm Star and Palm Heart use measured `rotationPivot` coordinates around their base and handle axes; the other pieces turn around their visual centers. A fixed orthographic camera and full swept-radius fitting keep every piece inside its frame.

Move the mouse across a model to turn it through 360°. Entering the stage preserves the current angle. On touch, swipe horizontally; vertical page scrolling remains available. Each model exposes an accessible horizontal slider with its angle from −180° to +180°. Keyboard focus pauses automatic rotation; Left and Right turn it, Home selects −180°, End selects +180°, and zero resets it. Screen readers receive the current rendered angle. Image fallbacks expose a non-focusable preview instead of slider controls. There are no visible rotation controls. Posters and STL links remain available when WebGL cannot run. STL downloads contain the displayed assembly at its source scale; they are not a prepared print layout. The site has no checkout, visitor accounts, analytics, or form backend.

## Domain

`public/CNAME` binds `poorlittlething.com`. Configure the same custom domain in the repository's Pages settings before changing DNS, then enable HTTPS when the certificate is ready. Preserve existing email MX records when editing website DNS.
