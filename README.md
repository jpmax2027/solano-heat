# solano-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jpmax2027/solano-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jpmax2027/solano-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLANO HEAT** is a complete top-down open-world crime game that runs in the
browser from static files — no build, no libraries, no network. Welcome to
**Port Solano**, a sun-baked coastal city of downtown blocks, a beach strip
and a working dock quarter, drawn at golden hour on a full day cycle.

You are **Rio Vargas**, a getaway driver fresh in town. Rico at the Taller
Solano garage has work: a five-job story chain — meet the crew, run a package
up the beach road, borrow a very collectible Sultan RS, shake a police
captain who wants an example made of you, and finish with a full-heat run to
the end of the Muelle 9 pier.

What's in the city:

- A full road grid with intersections, varied buildings (signed landmarks
  included: the police station, hospital, Hotel Brisa, Casa Azul, the chop
  shop), sidewalks, palms, lamps, crates, a beach, the sea, and two piers.
- On foot in 8 directions with collision, or behind the wheel of anything
  with wheels — every parked and moving car can be taken; traffic drivers
  bail out and run.
- Traffic AI that drives the road network and brakes for trouble, and
  pedestrians who stroll the pavements and flee gunfire and reckless driving.
- A 1–5 star wanted system: theft, hits, gunfire and mission heat raise it;
  staying unseen cools it. Interceptors spawn, hunt, ram and box you in —
  get caught on foot and you're **BUSTED**, hit zero health and you're
  **WASTED**. Both cost cash and drop you at the station or the hospital.
- Fists and a mouse-aimed pistol with tracers and muzzle flash, car damage
  with smoke and wrecks, and health / armor / cash / bribe pickups.
- A five-mission story with phone dialogue, on-screen objectives, timers,
  cash rewards and a story-complete state, plus free roam afterwards.
- HUD with health and armor bars, cash, wanted stars, current car or weapon,
  dialogue and objective lines, and a live minimap (roads, traffic, police,
  mission markers).
- Title, pause, busted and wasted screens; progress (cash, missions,
  position) saves to localStorage after every job.
- Procedural WebAudio sound only — engine hum, sirens, gunshots, pickups
  and a bassline while you drive. No audio files.
- Polish: day cycle into dusk and night with headlight cones and lit lamps,
  skid marks, crash screen shake, dust / spark / smoke particles and
  floating cash text.

Controls (also on the title screen): WASD or arrows to walk and drive,
**E** or **F** to enter/exit a car, **Shift** to run, mouse to aim,
click or **Space** to punch and shoot, **1** / **2** for fists / pistol,
**P** or **Esc** to pause, **M** to mute.

To play, serve the repo root (`node serve.ts`) and open `/game/` — or open
any static host at `game/index.html`. The four files in `screenshots/` are
real renders of this build, staged through the game's own `?shot=` scenes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=zbqpv30a&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
