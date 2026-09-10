# CLAUDE.md

Standing notes for work in this repository. [`README.md`](README.md) says what
is here; this file says what has bitten us.

## This is a fork: pull requests go to calvinyu94-debug/mvmt-atlas only

This repository is a fork of ashemag/human-atlas, and `gh` treats the parent
as the default base for a fork. Twice a PR meant for this fork was opened on
upstream (ashemag/human-atlas #232 and #235) and had to be closed there.

**Never open a pull request on upstream.** Every `gh pr create` here passes
`--repo calvinyu94-debug/mvmt-atlas --base main --head calvinyu94-debug:<branch>`,
and `gh repo set-default calvinyu94-debug/mvmt-atlas` is set in the clone.
Check the URL `gh` prints before doing anything else.

## The models

`public/models/atlas.json` is BodyParts3D's atlas plus the MVMT layers merged
in by `scripts/merge-layers.mjs` (see README, "MVMT layers"). Only the `.gz`
chunks are committed; GitHub Pages serves them as raw bytes and the viewer
decompresses them itself. The pipeline after a new export from mvmt-anatomy:

    node scripts/merge-layers.mjs <anatomy.json> <structure-meshes.json> <bp3d-fit.json>
    node scripts/rechunk-bp3d.mjs <region-assignment.csv>
    node scripts/build-overview.mjs
    node scripts/compress-models.mjs
    node scripts/validate-atlas.mjs && node scripts/validate-interactions.mjs

- `rechunk-bp3d.mjs` deletes the old chunk files **before** packing: a re-run
  writes the same `body-<region>` names, and deleting afterwards deleted the
  new files too, which lost the local BP3D geometry once (restored from git).
- The scene holds chunk sets on demand (`chunkKeysFor` in `app/anatomy.ts`).
  A region view fetches its own BP3D and MVMT chunks; arteries, veins and
  organs are separate sets fetched only when one of their systems is on; the
  whole body is the decimated overview. The first render decides the first
  fetch, so the URL's systems (or a region view's defaults) must be in the
  state before the atlas arrives - `initialVisible()` in `app/page.tsx`.

## Regions, context, lines: what the viewer holds

- A part is loaded from one layout at a time: full detail (`main:<chunk>`), the
  overview (`overview:<chunk>`) or a region's context (`context:<region>`, a copy
  of the neighbours' spanning parts, drawn with the context material, excluded
  from picking, explode and a fascial line's stations). The keys are
  built by `chunkKeysFor` / `contextKeysFor` in `app/anatomy.ts`; the first bug
  here was a context key spelled `main:<i>`, which loaded a chunk with no parts
  in it and drew nothing, silently. `window.__atlas` in the console reports
  which sets are held and how each part is loaded.
- Context is fetched only after every own chunk has been drawn (`ownComplete`
  in `app/scene.tsx`); a context set that fails to load is a warning, not an
  error.
- Spanning (what goes in a region's context) is decided against the region's
  bounds, and the bounds are **the union of its own bones, one box per side for
  a paired region**: a part spans a region when its centroid lies in that box
  or at least 15% of its triangle centroids do. Three definitions were
  measured before settling on this one - the union of every assigned part
  (12.8 MB of context for elbow-wrist), the landmark anchors plus 50 mm (the
  cervical anchors on the acromia put both shoulders in its box), a single
  box for a paired region (both arms' box spans the whole trunk). Thoracic
  and shoulder contexts are still 5 to 6 MB: that is what surrounds them.
- `scripts/overrides.mjs` holds the hand-kept tables: BP3D's mislabels
  (sixteen muscles and the iliotibial tract filed as skeletal) and
  `CONCEPT_MATCHES`, the BP3D concept names that stand for MVMT structures
  whose names match nothing or match the wrong thing, read for muscle depth
  and for the fascial-line stations alike. Both are reviewed as descriptions;
  `build-index.mjs` stops if a listed name is not in the atlas or a key is not
  a structure of mvmt-program's.
- **A BP3D name is several concepts, and a match must return all of them.**
  BP3D holds many muscles as a pair of sided concepts ("right rhomboid
  major", "left rhomboid major") beside or instead of an unsided one, and the
  name normaliser drops "right" and "left", so an index that keeps the first
  concept under a name resolved "pectoralis major" to the right one alone,
  and "biceps brachii" to its short head alone. `build-index.mjs` now keeps
  every concept under a name and every smallest containing concept, prunes
  the ones whose meshes sit inside another's, and records the resolved mesh
  count per side on each station so a one-sided answer shows in the JSON.
  The first pass also carried a manual table keyed by station ids that had
  drifted (`hip-it-band` for `hip-itb`, `thoracic-latissimus` for
  `shoulder-lats`) and dropped names it could not find without a word; both
  are hard errors now.
- **A fascial line is drawn as its stations, never as a path.** Picking a
  line lights every part its stations resolve to, both sides, in `--v3-line`
  (opaque, lit, a little emissive) whatever the system toggles say, and drops
  everything else that is loaded to a ghost: `--v3-ghost` at 12%, flat, no
  depth write, unpickable, one colour so the blend order cannot matter. When
  no system is on the ghost is the skeleton and muscles, so there is a body
  to place the line on. The stations are one merged mesh in the line
  material, rebuilt when the line or the loaded sets change; the ghost is one
  material swapped onto every loaded mesh (`setLineActive` in
  `app/scene.tsx`). The first version drew a tube through one point per
  station and lit nothing, which read as a wire down one leg: the connective
  tissue between stations has no geometry here, and a path claims it does.
  In a region view the region's own stations light and the region is the
  ghost; the context is hidden. Off while exploded or isolated. Every
  station is listed in the panel, and one this body cannot light says so on
  its row ("not on this model", "attachments only · muscle not on this
  model", "not in this region") - never dropped. Patient view keeps the
  highlight, the blurb and the caveat and hides the station list.
  `window.__atlas.line()` reports what a lit line is drawing.
- An empty context chunk is an error in the console and in
  `validate-atlas.mjs`, never a silent blank.
- Region assignment of BP3D parts is by name against mvmt-anatomy's
  `region-assignment.csv` first (so the ribs are thoracic and the hip bones
  lumbar, as in our own viewer) and by landmark distance only for the rest.
- The nerves and the spinal cord are schematic. The label "Schematic —
  indicative path only" shows whenever a schematic layer is on or a schematic
  part is selected, and in the detail sheet; it has no close control. The
  fascial lines carry their own caveat the same way. Neither is to be softened
  for tidiness: that is the failure they exist against.

## Fidelity of the authored layers (Phase 4)

- **Thirteen muscles are ours, not BodyParts3D's.** The Muscles system holds
  36 parts with `source: zanatomy` (`carried: true`, `carriedFor` naming the
  MVMT structure): masseter, temporalis, the pterygoids, occipitofrontalis,
  latissimus dorsi, multifidus, quadratus lumborum, transversus abdominis,
  the internal oblique, rectus abdominis, spinalis capitis, extensor
  digitorum brevis, which BodyParts3D as Human Atlas selected it does not
  model. They live in the MVMT region chunks, take their depth from the
  structure that claims them (`build-index.mjs` reports them under
  `carriedStructures`), and light as full stations on the fascial lines (the
  SBL's scalp, the SFL's rectus abdominis) with nothing changed in the viewer.
  `CONCEPT_MATCHES` still lists them with an empty array: nothing in BP3D to
  match, the belly arrives as our own mesh. Three of the 29 "missing" muscles
  were BP3D's names (rhomboids, rotatores as "rotator", the hamstring origin),
  four have no belly in Z-Anatomy either; `scripts/overrides.mjs` says which.
- **BodyParts3D 4.0 has nothing to add.** The IS-A archive Human Atlas used is
  the whole release (2,234 elements); the PART-OF archive is a 1,258-element
  subset of it. Its nerves are cranial and orbital only, its "spinal cord" is
  a 160-triangle central canal, its ligaments are laryngeal, ocular and
  plantar, it has no bursae. Every MVMT layer stays authored; there is no
  imaging-derived replacement to fetch. Do not spend time on the archives
  again without a new release.
- The authored looks live in `LOOKS` in `app/scene.tsx` and their colours in
  the `--v3-*-surface` tokens: nerves matte cream with a fibrous grain in the
  normal, ligaments ivory with a sheen along the part's long axis (the fibre
  direction, per part, from a texture), fascia translucent at 0.35 drawn
  before the insertion patches, the dura a translucent sheath. The nerves are
  tubes rebuilt from their centrelines in mvmt-anatomy's export, tapered and
  continuous with their plexus; the cord follows published cross-sections
  with both enlargements, roots at every level, thirty cauda strands.
- `fitConfidence: low` on a carried-over part is judged by one rule per
  system, named in the part's `fitRule` and set in mvmt-anatomy's
  `bp3d_export.py`: `surface` for ligaments and fascia (more than 20% of
  sampled vertices further than 6 mm from any BP3D bone or muscle surface),
  `canal` for the central nerves (more than 20% inside bone; the median
  clearance from the canal wall is recorded, not judged), `envelope` for the
  peripheral nerves (more than 20% outside BP3D's skin or inside bone; no
  surface-distance test). Patient view hides every low part. The detail sheet
  words the note by the rule. The single surface rule of Phase 4 flagged the
  cord for sitting in the middle of its canal, and applying the canal rule
  found that the cord below C7 had been authored through the vertebral
  bodies; the fix and the counts are in mvmt-anatomy's
  `verification/bp3d-fit-report.md`.

## The embed API

`app/embed.ts` is the contract with mvmt-program. When testing it in the
Browser pane, open the pane on the URL first: a pane opened fresh collapses
the URL to its origin, and an empty `location.search` looks like a race in
the app when it is not.

## Theme

Colour lives in the Clay Soft token block at the top of `app/globals.css`,
copied from `mvmt-program/index.html`, and nowhere else; the 3D stage reads
its colours from the same block through `getComputedStyle`.
