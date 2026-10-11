# Verified local character admission — Sprint 2

No character binary was supplied or acquired. `src/data/stationCharacter.ts` is deliberately null. The existing procedural station host is a temporary placeholder; **no NPC visual improvement is claimed**. The user explicitly directed development to continue without a new character and prohibited retrying the blocked binary.

## Author / licence before bytes

A public portfolio GLB is a redistributable file. Verify the **individual asset's** author and licence, including public redistribution and modifications, before acquisition. A marketplace's general terms, a “free” price or a Mixamo account is insufficient. This admission command accepts reviewed CC0-1.0 and CC-BY-4.0 metadata; other licences require a separate, specific redistribution review. Preserve attribution for CC-BY.

Do not use Quaternius's low-poly/game-stylized catalogue merely because its licence is convenient. Close people require appropriate proportions, authored skin/clothing textures, a believable silhouette and a functioning rig. Neither unit fixtures nor another primitive figure meets this gate.

## Local workflow

After independently verifying the source/licence, supply an embedded GLB and a provenance JSON:

```json
{
  "author": "Actual asset author",
  "source": "https://publisher.example/individual-asset",
  "license": "CC-BY-4.0",
  "licenseEvidence": "https://publisher.example/individual-asset-licence",
  "licenseReviewedOn": "YYYY-MM-DD",
  "redistributionPermitted": true,
  "sourceSha256": "actual lowercase SHA-256 of the supplied GLB",
  "modifications": "Actual conversion, mesh reduction, texture changes and tool versions; retain the original archive checksum separately when applicable"
}
```

Placeholders above are a **schema example**, not source or licence evidence. Compute the actual file hash using `sha256sum`. Then run from the repository:

```sh
node scripts/import-character.mjs /local/character.glb /local/provenance.json
```

The command checks the embedded GLB/header/buffer/accessor layout, skins, named rig-bound Idle/Walk clips and time/output accessors. It rejects remote/data image or buffer URIs and required unsupported decoders. Limits: 8 MiB, 12,000 triangles, four primitives/materials, 15–80 joints per rig, 1–4 embedded PNG/JPEG images at most1024×1024. Image **headers** are inspected here; real image decoding and skeleton rendering still happen in Three. These caps do not grant permission to exceed the street's rendering budget.

A successful command writes a content-hashed GLB, its provenance/inspection record under `public/models/`, and a **candidate** descriptor in `src/data/stationCharacter.ts`. The supplied hash must match before any file is copied. Static checks do not establish realistic anatomy, clothing, texture quality or useful motion.

## Rendered review and approval

In development, use `?debug&characterPreview=idle#world`, then `?debug&characterPreview=walk#world`. Enable full motion to see both clips. Walk preview is explicitly in-place at the station host's position; it is not a new navigation agent. The original interaction point, route and collision remain unchanged. Loader/checksum/rig errors retain the original host.

Review the native NPC close-up and an animation recording. Confirm approximately1.72m standing height, ground alignment, skeleton binding, facing direction, clothing/skin appearance, both clips, foot sliding and lighting. Inspect source/export integrity and attribution. Re-run Medium counts with the actual replacement: current textures/programs are already at their ceilings. An added normal-map/skin material can require other resource reductions.

Only after that review, change the descriptor's status to `approved` and provide a non-null `visualReview` with actual reviewer/date/notes. An approved descriptor is eligible for normal runtime loading; a candidate is development-preview only. Runtime loading is SHA-256 checked again by the existing lazy GLB library. `data-character-status="loaded-awaiting-rendered-review"` means attachment occurred, **not** that visual acceptance or useful animation has been proven.

No supplied/installed binary exists in Sprint 2, so none of these future preview/acceptance steps is reported as exercised with a real human. Original in-memory rig fixtures and static admission tests validate code paths only.
