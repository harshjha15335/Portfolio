# Film City Talkies: the trailer and the full house

The Talkies in Film City plays a 42-second action trailer of Harsh's portfolio, with sound, to a full auditorium.

## What is where

| Piece | File |
| --- | --- |
| Trailer (H.264/AAC and VP9/Opus), poster, captions | `public/media/talkies-trailer.{mp4,webm,jpg,vtt}` |
| Source list and codec pick | `src/data/trailer.ts` |
| Theatre player (play/pause, sound, replay, the nine scenes as text, exit) | `Theatre` in `src/ui/CityExperience.tsx` |
| Big screen in the hall and the seated audience | `src/game/World/districts/TalkiesHouse.ts`, wired in the Film City spec in `catalog.ts` |
| How the trailer was made | `scripts/trailer/` |

## In the world

- **Full house.** Every free seat (137 of 140; three are the existing seated cast) is filled by the licensed Rocketbox street cast. Each cast member is CPU-skinned once into the seated pose (`bakeSeated`) and drawn from its simplified far LOD as one `InstancedMesh`, so the whole audience (about 63k triangles) is about one draw per cast member, adds no bone texture, and reuses the cast's own materials. It is only visible while the visitor is inside the hall.
- **Big screen.** A plane with a `VideoTexture` sits in front of the painted title card. The video is fetched when the visitor enters the lobby and plays, looping, while they are in the hall. It is muted unless city sound is on, pauses whenever a modal covers the world or the tab is hidden, and never autoplays under reduced motion (the title card stays).
- **With sound.** Pressing E at the screen or the box office opens the theatre, which starts the trailer with sound (the click or key press is the user gesture). If a browser still refuses, it starts muted and the SOUND button turns it on. Captions (`.vtt`) carry every title and describe the score.

## How the trailer was made

Everything in it is original to this project: footage rendered from this city, titles set in the site's own OFL fonts (Barlow Condensed, IBM Plex Mono), and a score synthesised from scratch with NumPy. No third-party footage, music or samples.

1. `rec.mjs` renders the 15 camera shots from the dev server (`/?debug&review=1&time=17:40#world`, golden hour). It replaces `requestAnimationFrame` with a virtual clock, sets `setFixedStep(1/24)`, and overrides the camera just before each render (keyframed moves, or a chase that follows a district car), then screenshots each frame. About 2 s a frame under SwiftShader; ~820 frames.
2. `synth.py` writes the 42 s score: drone and jet fly-bys in the cold open, a brass "braam" on the title, then 120 BPM drums, taiko, a D-minor ostinato and pads, an anthem line, a riser into half a second of silence, and the final hit.
3. `comp.html` + `comp.mjs` composite each frame: the shot, a teal/orange grade, vignette, grain, shake on hits, flashes, anamorphic streaks, and the titles (all facts from the résumé).
4. `ffmpeg` encodes 1280×544 at 24 fps: H.264 Main + AAC (`+faststart`) and VP9 + Opus.

```sh
npm run dev   # in another terminal
node scripts/trailer/rec.mjs scripts/trailer/shots.mjs <out>/shots-out
python3 scripts/trailer/synth.py <out>/score.wav
node scripts/trailer/comp.mjs <out>      # writes <out>/comp-out/0000.png …
sh scripts/trailer/encode.sh <out>/comp-out <out>/score.wav public/media
```

Shots that show a district are footage of the city as it was on 2026-10-21. Re-run the steps above to refresh the trailer after big visual changes.
