# MVMT Atlas

The anatomy viewer inside [MVMT Program](https://github.com/calvinyu94-debug/mvmt-program), forked from [ashemag/human-atlas](https://github.com/ashemag/human-atlas) (MIT). An interactive 3D anatomy explorer built with React, Three.js, and shadcn/ui: the BodyParts3D adult male reference taken apart into **2,234 individually selectable meshes**, **15 anatomical systems**, and **3,432 searchable named concepts**, restyled to MVMT's Clay Soft theme and driven from a parent frame through an embed API.

**[Open the deployed viewer](https://calvinyu94-debug.github.io/mvmt-atlas/)**

## Explore

- Orbit, zoom, and select structures directly on the body; double-tap to frame one.
- Pick a region (MVMT's nine, or the whole body): a region fetches only its own chunks, frames itself, and draws the neighbours' parts that reach into it dimmed and unselectable once its own are in.
- Toggle systems: skeleton, muscles, joints & ligaments, fascia, the nervous system (our schematic central and peripheral nerves and BodyParts3D's brain and cranial nerves, with sub-toggles), insertions, landmarks; arteries, veins and organs wait in a "More systems" fold and load only when switched on.
- Muscle depth: all, superficial or deep, from MVMT's classification (a muscle without one is shown under every setting).
- Trace a fascial line: every station along its route lights up in the line colour, both sides, whatever the system toggles say, and the rest of the body drops to a ghost (in a region view, the region's own stations and the region as the ghost). A station this body cannot light says so on its row. Hidden while the anatomy is exploded, and never without its caveat.
- Six preset views and reset; patient view hides identifiers, counts and the low-confidence landmarks.
- Move from assembled anatomy to a spaced inventory of every visible piece; search anatomical names, MVMT ids and source identifiers; isolate a selected structure and read its details.

## Embed API

MVMT Program hosts the viewer in an iframe. The viewer reads these keys as URL parameters on load, and accepts the same keys afterwards as `window.postMessage({type:'set', ...}, '*')` from the parent frame. Every key is optional; a message changes only what it names.

| Key | Values | Effect |
|---|---|---|
| `model` | `bp3d` | Which manifest to load. Only the BodyParts3D body exists; the MVMT layers are fitted onto it. A second body is a future option, and the comparison between engines is the Model switch in mvmt-program. |
| `region` | `head-jaw`, `cervical`, `shoulder`, `elbow-wrist`, `thoracic`, `lumbar`, `hip`, `knee`, `ankle-foot` | Opens that region: its own chunks are fetched and framed, its neighbours' spanning parts drawn dimmed afterwards. Absent or unknown means the whole body (the decimated overview). |
| `systems` | comma-separated system ids (`skeletal,muscular,...`), or an array by message | The systems to show. |
| `select` | an FMA concept id, a BP3D part id, or an MVMT id (`knee-acl`, `lm-asis`, `ZA-iliotibial-tract`) | Selects and opens the detail panel. |
| `view` | `anterior`, `posterior`, `left`, `right`, `superior` | Camera preset. |
| `patient` | `1` or `0` | Patient view: hides identifiers, counts, the source link and credits; of a fascial line it keeps the highlight and the blurb and hides the station list. |
| `line` | `SBL`, `SFL`, `LL`, `SPL`, `DFL`, `SFAL`, `DFAL`, `SBAL`, `DBAL`, `BFL`, `FFL`, `IFL` | Traces that fascial line: its stations lit, the rest of the body ghosted. An empty value clears it. |

The viewer posts back to its parent: `{type:'ready', model, parts}` once a manifest has loaded, `{type:'select', id, name}` on every selection change (`null` when cleared), `{type:'unresolved', id}` when a requested selection is not in the atlas, and `{type:'unresolved', line}` when a requested line is not one of the twelve. The contract lives in [`app/embed.ts`](app/embed.ts).

```
https://calvinyu94-debug.github.io/mvmt-atlas/?systems=skeletal,muscular&view=posterior&select=FMA7088&patient=1
```

## MVMT layers

`atlas.json` also carries the MVMT layers fitted onto the BodyParts3D body by [mvmt-anatomy](https://github.com/calvinyu94-debug/mvmt-anatomy) (`tools/bp3d_fit.py`, `tools/bp3d_export.py`): fascia, joints & ligaments, insertions, peripheral nerves, central nerves, landmarks, and the muscles BodyParts3D does not model (masseter, temporalis, the pterygoids, occipitofrontalis, latissimus dorsi, multifidus, quadratus lumborum, transversus abdominis, the internal oblique, rectus abdominis, spinalis capitis, extensor digitorum brevis - 36 parts under the Muscles system, `source: zanatomy`, with their depth), 1,530 parts in one gzipped chunk per MVMT region (`mvmt-<region>.bin.gz`) so a region can be fetched on its own, beside BP3D's own 15 chunks, which are untouched. Every layer part carries `source` (`zanatomy` or `schematic`), `sourceName`, `region`, the regions it spans and the MVMT structures that claim it; the nerves and the spinal cord are schematic and say so. `atlas.regions` lists each region's chunk and the parts that span into it; `atlas.overview` is a decimated whole body (every part, 582k triangles, 8.4 MB) for orientation. Alongside: `mvmt-fma-match.json`, our names matched to BP3D concepts, and `fascial-lines.json`, the twelve myofascial lines as ordered structures, each station resolved to concept ids on this body (our exported meshes and BP3D's, both sides) with a `status` saying whether that is the structure itself, only its insertion patches, or nothing, and a count of the resolved meshes by side.

To rebuild after a new export: `node scripts/merge-layers.mjs <anatomy.json> <structure-meshes.json> <bp3d-fit.json>`, `node scripts/rechunk-bp3d.mjs <region-assignment.csv>` (BP3D's own parts by region, with a context chunk per region and the vessel and organ sets), `node scripts/build-overview.mjs`, `node scripts/compress-models.mjs`, `node scripts/build-index.mjs <anatomy.json> <structure-meshes.json>` (muscle depth and the fascial lines), then the validators. `atlas.chunkSets` says which chunks a view fetches; `atlas.contexts` holds each region's dimmed surround. `scripts/overrides.mjs` carries the hand-kept tables the pipeline reads: BP3D parts filed under the wrong system, BP3D parts the landmark-distance assignment homes in the wrong region (the thoracic wall), which regions neighbour which, and the BP3D concept names that stand for MVMT structures whose names match nothing or match the wrong thing (read for muscle depth and for the fascial-line stations alike; the build stops on a name the atlas lacks). A region's context leaves out a neighbour's part larger than 200 KB with under 15% of its triangles inside the region and lists it under `atlas.contexts[region].excluded`; every part records `spanFractions` per region it spans.

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
