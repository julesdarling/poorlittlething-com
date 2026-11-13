# Poor Little Thing

An art showcase for Poor Little Thing, with a rotating 3D gallery and links to individual Cults3D listings. Built as a static Vite site for GitHub Pages, with locally bundled Three.js, GSAP, and Albert Sans fonts.

## Development

```sh
npm ci
npm run dev
```

The local preview runs at `http://127.0.0.1:4173/`.

```sh
npm run build
```

Use Node.js 24, matching the GitHub Actions workflow. The production website is generated in `dist/`. Before Vite runs, `scripts/check-catalogue.mjs` validates the Cults3D URLs, gallery assets, and absence of local print downloads. No Python packaging step is required.

The GitHub Actions workflow builds and deploys `dist/` when `main` changes. To inspect a production build locally, run `npm run preview`.

## Content

- `public/products.json` contains each piece's canonical design ID, descriptive title, category, Cults3D listing URL (`cultsUrl`), colored GLB, and preview image URLs.
- `public/assets/models/` holds the interactive colored GLB display models.
- `public/assets/products/` holds transparent fallback poster images.
- `public/assets/backgrounds/` holds nine supplied flat backdrops with varied assignments across rows and filtered lists.
- `public/assets/hero.webp` is the supplied hero artwork.
- `public/assets/stacked-logo.svg` preserves the approved stacked brand artwork.
- `index.html` contains the introduction, manifesto, inquiry address, and metadata.
- `src/style.css` defines the layout and brand colors.
- `src/gallery-3d.js` controls the interactive gallery.

The catalogue contains all 44 approved non-tag designs, including the Ring Clamp Pair, Three-Foot Chain Leash, Toy Pliers, Candy Hearts Collar, and Large Spike Collar. Each product card links to its individual public Cults3D listing, priced at US$6.66 with a personal-use license. Purchase, licensing, and delivery of the printable files happen on Cults3D. The website has no checkout, visitor accounts, analytics, or form backend.

The site does not host STL, 3MF, G-code, or ZIP print downloads. The former collection and tag bundles, assembly STLs, tag inputs, bundle manifest, and packaging script were preserved outside this repository at `../website-setup-evidence/cults-links-2026-11-12/retired-site-downloads/`. Their file sizes and SHA-256 hashes are recorded in `../website-setup-evidence/cults-links-2026-11-12/retired-downloads-manifest.json`. Keep historical and canonical print sources outside the website's public assets.

## Updating the catalogue

Use a verified public Cults3D buyer URL for each product's `cultsUrl`. Preserve the product's design ID, GLB, poster, background, and presentation settings when changing its purchase link. Do not add local print-download URLs or metadata to `products.json`.

Run `node scripts/check-catalogue.mjs` to validate the catalogue without building it. Before deployment, check the fresh `dist/` directory for retired print assets and confirm the purchase links, 3D gallery, and image fallbacks. After deployment, verify that the former print-download URLs and bundle manifest return HTTP 404 while the gallery assets remain available.

## Interactive gallery

The gallery uses one shared WebGL renderer with local canvas copies, avoiding a separate WebGL context for every piece. Models load near the viewport, and GPU resources are released as distant pieces leave the active set. Each model rotates while its camera, lights, and background stay fixed. Models rotate slowly until the mouse enters, follow pointer movement while hovered, and resume slow rotation when the mouse leaves. Reduced motion preferences disable automatic rotation and pointer interpolation.

The toys float in front of flat, subtly blurred backdrops. A shared soft shadow layer uses the warm taupe sampled from the supplied images and appears beneath both the poster and live model. Pieces modeled lying down use explicit upright presentation rotations. The star and heart palm grips use measured `rotationPivot` coordinates around their base and handle axes; the other pieces turn around their visual centers. A fixed orthographic camera and full swept-radius fitting keep every piece inside its frame. Cards pair each descriptive title with a small circular external-link icon; hover and keyboard focus show the Cults3D destination and price.

Move the mouse across a model to turn it through 360°. Entering the stage preserves the current angle. On touch, swipe horizontally; vertical page scrolling remains available. Each model exposes an accessible horizontal slider with its angle from −180° to +180°. Keyboard focus pauses automatic rotation; Left and Right turn it, Home selects −180°, End selects +180°, and 0 resets it. Screen readers receive the current rendered angle. Image fallbacks expose a non-focusable preview instead of slider controls. Posters and Cults3D links remain available when WebGL cannot run.

## Domain

`public/CNAME` binds `poorlittlething.com`. Configure the same custom domain in the repository's Pages settings before changing DNS, then enable HTTPS when the certificate is ready. Preserve existing email MX records when editing website DNS.
