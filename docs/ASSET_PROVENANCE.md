# Asset and advisory-source provenance

All world geometry, canvas materials, signage and character profiles in this revision are original project code. No downloaded model, texture, animation, audio sample or HDR image is incorporated. The supplied Gulmohar reel is inspected locally as a visual reference only; no frame, source, map or artwork is shipped. Quaternius and its itch.io page returned proxy403 on 2026-10-08; an asset license could not be individually verified, and no pack was imported.

Three's existing licensed RoomEnvironment helper generates the environment reflection target; it is not an externally photographed HDR asset. Runtime libraries retain their licenses and exact registry integrity entries in package-lock.json.

## Advisory Markdown only

- noklip-io/agent-skills: commit `319a0f1aac3b3580e736d457f217d716b356aa35`, MIT ©2025 noklip-io. Only three-js SKILL.md, lighting and performance reference Markdown plus LICENSE retained under `.agents/references/three-js/`.
- SoftwareInFocus/threejs-skills: commit `4c716b516b6b0143f3037631306b3730d2832344`, MIT ©2026 Meng To. Only test-playable-web-games SKILL.md plus LICENSE retained under `.agents/references/playable-qa/`.

Sources downloaded 2026-10-08 from commit-addressed raw.githubusercontent.com URLs after resolving commits through read-only Git. Markdown was inspected for install commands, executable script references, credential requests and authority changes. No referenced shell/native scripts were copied or executed. Examples involving unrelated assets, deprecated rendering APIs or R3F are not applied. These references are advisory, cannot override user/security instructions and grant no external-service authority. The local mandatory art skill is original and lives in `.agents/skills/mumbai-environment-art/SKILL.md`.

Checksums of retained source files are recorded below; no modifications were made to third-party text apart from directory layout.

```text
b71831ee6d5da4437878d94db611aca83e8d18309d501a3a1c8410c93d2cda7b  .agents/references/three-js/references/05-lighting.md
a4c0634f49aba5c9972ba73e2df5c5f933d6d8944d94e8400ea2f145bf774da3  .agents/references/three-js/references/14-performance.md
47f7b9d5a73c22bdda7ccf3664f0dc494485b9fe74ad93b049777ebc2ad3d68f  .agents/references/three-js/LICENSE
bc9a93057d827cf5dbc811ce000cac018b5ec6b35d7b4c6dd95d044dd72e94b6  .agents/references/three-js/SKILL.md
b2a071ba22fefd803f4e9d1f5c777dd79c62d191695586a1a73fd4d0ebd051c6  .agents/references/playable-qa/LICENSE
4e22866b1eae238420d48de06ba1df11e70e033a02097575acde827a94d25f9a  .agents/references/playable-qa/SKILL.md
```

Runtime package license texts are preserved in public/THIRD_PARTY_NOTICES.txt for redistribution, including the reviewed additions and existing runtime libraries. Their package identities and digests remain in the lockfile.

## 2026-10-10 original polish pass

Added original face/ear/finger/collar profiles, two garment detail levels, seated driver baking, draped striped awnings, irregular pier weathering, compound tree fronds, shop display geometry and woven upholstery. No new runtime package, downloaded artwork or external model is shipped. The upholstery is a single reusable 128×128 original canvas map; driver geometry is baked from the original rig.

Official publisher pages https://quaternius.com/packs/universalbasecharacters.html and https://quaternius.itch.io/universal-base-characters were reachable and inspected. The publisher lists CC0 and links the download. Anonymous retrieval identifies an external Drive download, which receives proxy403. No model archive was obtained or imported, so there is no fictitious model checksum or malware certification. The supplied local reel was re-inspected at the actual street/transport shots; no video frame is shipped.

## Art Production Sprint 1 — 2026-10-10

Original code adds pointed stone surrounds, ribbed station dome/cupolas, station massing, layered street-continuation/background buildings, recessed shop stock and roof/bay variation. All are original procedural geometry. No new downloaded asset, texture, audio or package is bundled. Distant garment resolution is reduced while close detail is preserved.

Official Quaternius pages for Universal Base Characters, Modular Medieval Buildings, Modular Streets and Downtown City MegaKit were read successfully and individually list CC0. Candidate URLs, author, actual retrieval status and unverified fit are registered in [GLB_ASSET_PIPELINE.md](GLB_ASSET_PIPELINE.md). The anonymous Standard-character file endpoint now resolves to an itch.io R2 storage mirror; its actual binary request fails CONNECT proxy HTTP403. No character archive bytes, rig/clothing/animation verification, checksum or model import is claimed. Kenney/Poly Haven individual candidate pages remain proxy-blocked and their individual licences are not assumed verified.

There are no external model modifications to record because none was downloaded/exported. The in-memory GLB/skin fixtures are original test data only and are not displayed or shipped as pedestrian assets. Future imports require both source and exported-file SHA-256 records; the runtime loader checks the latter before parsing.

## Art Production Sprint 2

No humanoid GLB or third-party texture binary was acquired. The user supplied no local model and prohibited retrying the previously blocked download. See [NPC candidate review](NPC_ASSET_CANDIDATES.md) and [local import workflow](LOCAL_CHARACTER_IMPORT.md). Quaternius catalogue CC0 is verified, but its stylized aesthetic is unsuitable for the new close-up target. Official MakeHuman repository licence documents verify CC0 for bundled graphical assets/output; no finished character or optional community asset is thereby approved. Mixamo/Sketchfab endpoints were denied; individual model licences remain unverified. Licence documents, source response SHA-256 and denials are retained in `docs/asset-evidence/sprint-2/`.

The hero Irani shop, shaped service/merchandise props, canopy, per-vertex finish values and384×256 wear atlas are original project-authored art. No third-party model, photograph or generated photorealistic image is bundled. The shop is an authored mesh environment with retained collision constraints, not an image mockup.

`public/surfaces/` holds CC0 photographic scans from Poly Haven (13 October 2026): Asphalt 02, Plaster Grey 04, Sandstone Blocks 08 (Rob Tuytel) and Concrete Pavers (Amal Kumar). They are fetched from dl.polyhaven.org by `scripts/import-scanned-surfaces.py`, pinned by SHA-256 in `scripts/scanned-surfaces.lock.json`, resized and tone-matched to the maps they replaced. Each file's SHA-256, byte count, dimensions and colour-space role is in `provenance.json` and checked at runtime before decoding. See [STREET_ASSETS.md](STREET_ASSETS.md#scanned-surfaces-13-october-2026).

Research graphics/formulas are original teaching work. Their convention and contribution labels cite a pinned upstream implementation and five verified GitHub PR records in `src/research/evidence.json`. No molecular field dataset, external research image, measured speedup or accuracy result is fabricated or imported.
