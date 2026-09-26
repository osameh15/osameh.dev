# CV reel — 30-second motion graphics

`osameh-cv-reel.mp4` · 1920×1080 · 30 fps · 30 s · H.264 + AAC stereo soundtrack (ready for LinkedIn, X, YouTube or a portfolio embed).

| Time | Tab | Scene |
| --- | --- | --- |
| 0.0 – 4.5 s | `whoami.sh` | Terminal types `whoami --verbose`, avatar ring draws, name and role reveal |
| 4.5 – 9.0 s | `about.md` | "I build software that stays *solid.*" with counters: 4+ years, freelancing since 2017, GPA 3.77, 14 TA semesters |
| 9.0 – 16.5 s | `experience.log` | A playhead sweeps 2017 → 2026 and draws the career Gantt: Freelance, Arrap Startup, Datall, Fluxudio, Navatel |
| 16.5 – 21.5 s | `skills.cpp` | 26 skills fly into six groups, with a highlight wave over the core stack |
| 21.5 – 26.0 s | `education.json` | B.Sc. Software Engineering (University of Tehran), GPA ring, languages, and osameh.dev as the featured project |
| 26.0 – 30.0 s | `contact.ts` | Availability badge, osameh.dev, GitHub, LinkedIn and email |

The content comes from the portfolio's own data: `frontend/src/app/workspacePreferences.ts` (roles, skill catalog), `frontend/src/data/portfolioData.ts` (resume summary) and `config/availability.json`. The visuals reuse the site's colours, its IDE layout, the Neural Cipher avatar and `docs/img/home-dark.webp`.

## Soundtrack

`soundtrack.mjs` composes and synthesizes an original 120 BPM electronic cue in A minor (Am7 · Fmaj7 · C · G). It has no dependencies and uses no samples, so there is no third-party music licence to worry about.

- **Intro:** a filtered pad and arpeggio swell in under keyboard clicks timed to the typed `whoami --verbose`.
- **Groove:** a riser and impact hit each scene cut, and the drums, sidechained bass and 16th-note arpeggio kick in on "I build software".
- **Build:** claps and 16th hats join on the experience timeline, and a bell melody plays over the skills scene.
- **Outro:** the drums drop on the contact card and a final chord rings out and fades.

Scene cuts sit on the beat grid. If you move one in `index.html`, change `CUTS` in `soundtrack.mjs` to match.

## Preview and re-render

Open `index.html` in a browser to watch it loop live, and click to restart it with the soundtrack (run `node motion/cv-reel/soundtrack.mjs` once first to generate `soundtrack.wav`).

Each frame is a pure function of time (`window.renderAt(t)`), so the video is captured frame by frame instead of screen-recorded:

```bash
npm ci
node motion/cv-reel/soundtrack.mjs                # writes soundtrack.wav only
node motion/cv-reel/render.mjs                    # writes soundtrack.wav + osameh-cv-reel.mp4 (needs ffmpeg)
node motion/cv-reel/render.mjs --stills 3,12,29   # PNG stills for checking a frame
```

`FFMPEG=/path/to/ffmpeg` and `CHROMIUM_PATH=/path/to/chrome` override the defaults. To change the content, edit the `roles`, `groups` or `langs` arrays in `index.html` and re-render.

Fonts: Inter and JetBrains Mono (SIL Open Font License), bundled in `assets/` so every render looks the same.
