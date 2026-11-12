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

The production website is generated in `dist/`. The build requires Python 3 to package the STL downloads before Vite runs. The GitHub Actions workflow builds and deploys that directory when `main` changes. Generated ZIPs are excluded from Git and created during the build, allowing the full collection to exceed Git's individual-file limit.

## Content

- `public/products.json` contains each piece's canonical design ID, descriptive title, category, colored GLB, assembly STL, and poster image URLs.
- `public/assets/models/` holds the interactive colored GLB models.
- `public/downloads/` holds the complete displayed assembly STL files in millimeters.
- `public/downloads/poor-little-thing-full-stl-collection.zip` is generated with all 39 assembly STLs, 63 word-tag STLs, and a short README.
- `public/downloads/poor-little-thing-tags.zip` is generated as one download for all 63 word tags. Tags are not individual gallery cards.
- `download-sources/tags/` holds the tag STL inputs and their relative-path manifest outside the served website.
- `public/bundles-manifest.json` is generated with ZIP sizes, checksums, and stable content digests.
- `public/assets/products/` holds transparent fallback poster images.
- `public/assets/backgrounds/` holds nine supplied flat backdrops with varied assignments across rows and filtered lists.
- `public/assets/hero.webp` is the supplied hero artwork.
- `public/assets/stacked-logo.svg` preserves the approved stacked brand artwork.
- `index.html` contains the introduction, manifesto, inquiry address, and metadata.
- `src/style.css` defines the layout and brand colors.

The gallery uses one shared WebGL renderer with local canvas copies, avoiding a separate WebGL context for every piece. Models load near the viewport, and GPU resources are released as distant pieces leave the active set. Only the featured model rotates; its camera, lights, and background stay fixed. Models rotate slowly until the mouse enters, follow pointer movement while hovered, and resume slow rotation when the mouse leaves. Reduced motion preferences disable automatic rotation and pointer interpolation.

After changing catalogue STL files, rebuild both archives with `python3 scripts/package-stls.py --verify-rebuild`. The regular build also generates them automatically. Download cache versions use the stable content digests from the generated bundle manifest. The script verifies every member against its source STL and uses fixed archive metadata.

The toys float in front of the flat, subtly blurred backdrops. A shared soft shadow layer uses the warm taupe sampled from the supplied images and appears beneath both the poster and live model. Seventeen pieces that were modeled lying down use explicit upright presentation rotations. The star and heart palm grips use measured `rotationPivot` coordinates around their base and handle axes; the other pieces turn around their visual centers. A fixed orthographic camera and full swept-radius fitting keep every piece inside its frame. Rounded cards pair each descriptive title with a small grey circular STL icon; hover and keyboard focus show the file size.

Move the mouse across a model to turn it through 360°. Entering the stage preserves the current angle. On touch, swipe horizontally; vertical page scrolling remains available. Each model exposes an accessible horizontal slider with its angle from −180° to +180°. Keyboard focus pauses automatic rotation; Left and Right turn it, Home selects −180°, End selects +180°, and zero resets it. Screen readers receive the current rendered angle. Image fallbacks expose a non-focusable preview instead of slider controls. There are no visible rotation controls. Posters and STL links remain available when WebGL cannot run. STL downloads contain the displayed assembly at its source scale; they are not a prepared print layout. The site has no checkout, visitor accounts, analytics, or form backend.

## Domain

`public/CNAME` binds `poorlittlething.com`. Configure the same custom domain in the repository's Pages settings before changing DNS, then enable HTTPS when the certificate is ready. Preserve existing email MX records when editing website DNS.
