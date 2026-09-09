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
  from picking, explode and the fascial-line surface search). The keys are
  built by `chunkKeysFor` / `contextKeysFor` in `app/anatomy.ts`; the first bug
  here was a context key spelled `main:<i>`, which loaded a chunk with no parts
  in it and drew nothing, silently. `window.__atlas` in the console reports
  which sets are held and how each part is loaded.
- Context is fetched only after every own chunk has been drawn (`ownComplete`
  in `app/scene.tsx`); a context set that fails to load is a warning, not an
  error.
- Region assignment of BP3D parts is by name against mvmt-anatomy's
  `region-assignment.csv` first (so the ribs are thoracic and the hip bones
  lumbar, as in our own viewer) and by landmark distance only for the rest.
- The nerves and the spinal cord are schematic. The label "Schematic —
  indicative path only" shows whenever a schematic layer is on or a schematic
  part is selected, and in the detail sheet; it has no close control. The
  fascial lines carry their own caveat the same way. Neither is to be softened
  for tidiness: that is the failure they exist against.

## The embed API

`app/embed.ts` is the contract with mvmt-program. When testing it in the
Browser pane, open the pane on the URL first: a pane opened fresh collapses
the URL to its origin, and an empty `location.search` looks like a race in
the app when it is not.

## Theme

Colour lives in the Clay Soft token block at the top of `app/globals.css`,
copied from `mvmt-program/index.html`, and nowhere else; the 3D stage reads
its colours from the same block through `getComputedStyle`.
