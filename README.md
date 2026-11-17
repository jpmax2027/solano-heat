# solano-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jpmax2027/solano-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jpmax2027/solano-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLANO HEAT is a top-down open-world crime game set in Port Solano, a sun-baked coastal city, built for the make.fun bounty gta6-01 "Make GTA 6". Everything is original: the city, the characters, the cars, the story. Nothing from Rockstar Games — no GTA names, maps, logos, or assets.

You are Rio Vargas, a getaway driver working for the local crews. Four jobs stand between you and owning the city — if the Solano PD doesn't catch you first.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
# or open game/index.html directly — no network needed, plays fully offline
```

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open
http://localhost:8080). No network needed; the game plays fully offline.

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move on foot, drive when in a car |
| E or F | Enter / steal a car, exit a car |
| Shift | Run |
| Mouse + Click / Space | Aim and shoot the pistol |
| V | Punch |
| P / Esc | Pause |
| M | Mute |
| L (title screen) | Continue a saved game |

## The city

Port Solano is a full open world: a downtown road grid with intersections and
crosswalks, city blocks full of buildings, a central plaza, a beach strip and
the sea to the south, and the container docks to the east. Traffic follows the
road network and stops for cars ahead; pedestrians walk the sidewalks and flee
from gunfire and reckless driving. Any parked or traffic car can be stolen —
walk up, press E, and the driver runs for it (the cops notice).

## Systems

- **Driving** — acceleration, braking, steering with drift, skid marks, collisions, camera follow.
- **Wanted system** — 1–5 stars rise with car theft, hitting pedestrians or cars, and shooting; heat decays when you stay out of trouble.
- **Police** — cop cars spawn and pursue, faster and more numerous at higher stars; they ram your car, and on foot they can bust you (lose 20% of your cash, respawn at the police station). Health at zero means WASTED (hospital, same penalty).
- **Combat** — punch and pistol (mouse aim), muzzle flash, hit reactions, health and armor pickups.
- **Missions + story** — four phone jobs from Marco, with on-screen objectives, dialogue, timers, cash rewards, and a story-complete state:
  1. *The Package* — pick up a package at the docks.
  2. *The Delivery* — deliver a car to Marco's Garage before the timer ends.
  3. *Lose the Heat* — survive three wanted stars until the heat dies down.
  4. *The Dock Run* — clear the rival Vipers at the docks and reach the pier.
- **HUD** — health and armor bars, cash, wanted stars, current weapon/vehicle, mission objective, and a live minimap (roads, player arrow, traffic, police in blue, mission marker in gold).
- **Screens** — title with story intro and controls, pause, busted, wasted, story complete.
- **Save / load** — cash, mission progress, and position save to localStorage after every mission and on pause; continue with L.
- **Sound** — procedural WebAudio only: engine hum, police siren, gunshots, pickup chimes, and a bassline loop. No audio files.

## Screenshots

Rendered with headless Chrome from the game's own `?shot=` staging:

1. `1-start.jpg` — title screen over the living city.
2. `2-city.jpg` — on foot downtown: pedestrians, traffic, mission marker.
3. `3-drive.jpg` — driving fast through traffic.
4. `4-chase.jpg` — police chase at three wanted stars.

## Tech

Node 22, standard library only; the game itself is plain static ES modules
under `game/` (canvas 2D, no libraries, no network requests). `main.ts`
copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` via the vendored `vendor/makefun-game.ts`.

Run the dossier build with:

```sh
mkdir -p /tmp/gta6-out && MAKEFUN_OUTPUT_DIR=/tmp/gta6-out node main.ts
```

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zbqpv30a&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
