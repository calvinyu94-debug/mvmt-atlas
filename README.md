# MVMT Atlas

The anatomy viewer inside [MVMT Program](https://github.com/calvinyu94-debug/mvmt-program), forked from [ashemag/human-atlas](https://github.com/ashemag/human-atlas) (MIT). An interactive 3D anatomy explorer built with React, Three.js, and shadcn/ui: the BodyParts3D adult male reference taken apart into **2,234 individually selectable meshes**, **15 anatomical systems**, and **3,432 searchable named concepts**, restyled to MVMT's Clay Soft theme and driven from a parent frame through an embed API.

**[Open the deployed viewer](https://calvinyu94-debug.github.io/mvmt-atlas/)**

## Explore

- Orbit, zoom, and select structures directly on the body.
- Toggle individual systems or use skeleton and organ presets.
- Move from assembled anatomy to a spaced inventory of every visible piece.
- Search anatomical names and source identifiers.
- Isolate a selected structure and read its details.
- Use compact controls and detail panels on mobile.

## Embed API

MVMT Program hosts the viewer in an iframe. The viewer reads these keys as URL parameters on load, and accepts the same keys afterwards as `window.postMessage({type:'set', ...}, '*')` from the parent frame. Every key is optional; a message changes only what it names.

| Key | Values | Effect |
|---|---|---|
| `model` | `bp3d`, `zanatomy` | Which manifest to load. `zanatomy` reports that the model is not built yet until it ships. |
| `region` | a region key | Held on the root element as `data-region` for the region filter, which does not exist yet. |
| `systems` | comma-separated system ids (`skeletal,muscular,...`), or an array by message | The systems to show. |
| `select` | an FMA concept id, a part id, or one of our ids once merged | Selects and opens the detail panel. |
| `view` | `anterior`, `posterior`, `left`, `right`, `superior` | Camera preset. |
| `patient` | `1` or `0` | Patient view: hides identifiers, counts, the source link and credits. |

The viewer posts back to its parent: `{type:'ready', model, parts}` once a manifest has loaded, `{type:'select', id, name}` on every selection change (`null` when cleared), and `{type:'unresolved', id}` when a requested selection is not in the atlas. The contract lives in [`app/embed.ts`](app/embed.ts).

```
https://calvinyu94-debug.github.io/mvmt-atlas/?systems=skeletal,muscular&view=posterior&select=FMA7088&patient=1
```

## Run locally

Requires Node.js 22.13 or newer. No API keys or accounts are needed.

```sh
npm ci
npm run dev
```

Open http://localhost:3016/mvmt-atlas/. The site is built for the `/mvmt-atlas/` base path (see `vite.config.ts`); `atlas.json` keeps root-absolute chunk URLs and `app/base-url.ts` resolves them against the base at fetch time. To build the static site, run `npm run build`; the output is in `dist/`.

## Validate

```sh
npm run check
node scripts/validate-atlas.mjs
node scripts/validate-interactions.mjs
npm run build
```

Validation covers mesh buffers, names and concept membership, nonoverlapping exploded layouts at desktop and mobile aspect ratios, search and inspection contracts, and tap-versus-drag handling. Browser interaction checks have exercised selection, system controls, search, isolation, rotation, and 390×844, 320×568, and 844×390 layouts. Phone controls stay clear of the exploded inventory, and isolated structures fit the space above or beside the detail panel. Physical-device performance and real multitouch hardware have not been tested.

## Anatomy data

The current viewer uses **BodyParts3D 4.0**, an adult male reference anatomy, licensed **CC BY 4.0**. It does not represent every human structure or variation. Individual source meshes are distinct from named concepts, which may group multiple meshes. Descriptions distinguish general system context from individual organ explanations.

Geometry is simplified for browser performance while retaining every source mesh. The packaged model contains 2,288,268 triangles and downloads approximately 33 MB of compressed geometry. Only the gzipped chunks (`public/models/*.bin.gz`) are committed and served; GitHub Pages hands them over as raw bytes and the viewer decompresses them itself. Full credits, source links, and adaptation details are in [ATTRIBUTION.md](public/ATTRIBUTION.md).

This is an educational explorer, not a diagnostic or surgical tool.

## Theme

The Clay Soft tokens in `app/globals.css` are copied verbatim from `mvmt-program/index.html`: warm clay palette, light chrome, borderless panels on soft elevation, 6/12/16 px radii, Fraunces for headings and DM Sans for everything else. Every colour the stylesheet uses is a token from that block, and the 3D stage reads its ground, platform, ring and selection colours from the same block through `getComputedStyle`, so a theme change is an edit to one block.

## How it works

Geometry is merged into batches. Per-structure GPU textures control translation, visibility, and selection, while component geometry supports accurate picking. Exploded layouts pack only the visible pieces. Rendering updates when the scene changes; orbit controls remain responsive without thousands of separate draw calls.

The optional WebMCP tools expose anatomy search and inspection in compatible browsers. The visible interface works without them.

## Rebuilding geometry

The repository includes browser-ready geometry. Rebuilding it is optional: obtain the official BodyParts3D OBJ archive and English metadata tables, prepare the joined concepts and display-system mappings, run `scripts/convert-anatomy.py`, then `node scripts/optimize-anatomy.mjs` and `node scripts/compress-models.mjs`. The compress step writes the `.gz` chunks and removes the uncompressed `.bin` files; `validate-atlas.mjs` reads whichever is present. Simplification uses a 0.2% relative error limit per structure.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` (Node 22, `npm ci`, `npm run check`, `npm run build`) and publishes `dist/` to GitHub Pages through `upload-pages-artifact` and `deploy-pages`. The repository's Pages source is GitHub Actions. The workflow can also be run by hand from the Actions tab.

## License

Original application code is released under the [MIT License](LICENSE); the fork keeps the upstream history and credit. **The anatomy data has its own CC BY 4.0 license**; preserve the attribution when redistributing it. Third-party dependencies retain their respective licenses.
