# Ninth Atlas Residences — Cinematic Walkthrough

A reproducible Git-based pipeline for generating and assembling a premium cinematic residential walkthrough using Runway Dev.

## Current status

S0 scaffold is in place. No paid Runway generation is required yet.

## Production doctrine

- One fictional branded property: **Ninth Atlas Residences**.
- Source/reference imagery stays local by default and is not committed to this public repository.
- Geometry and material continuity outrank visual novelty.
- Generate short controlled scenes, review, then assemble the final film.
- Runway API is called only after local asset validation passes.

## Local setup

```bash
git clone https://github.com/alexhsm/noida.git
cd noida
npm install
```

Copy the selected reference images into `assets/source/` using the exact filenames in `manifests/project.json`, then run:

```bash
npm run validate
npm run scene:list
```

Do not create `.env` or buy Runway credits until validation is clean. When we reach the first paid generation step, copy `.env.example` to `.env` and place the Runway API secret there. Never commit `.env`.

## Canonical local asset names

```text
01_masterplan_aerial.jpg
02_tower_hero.jpg
03_tower_canyon_garden.jpg
04_arrival_podium.jpg
05_poolside_clubhouse.jpg
06_double_height_lobby.jpg
07_lift_lobby_common_area.jpg
08_living_room.jpg
09_dining_room.jpg
10_kitchen.jpg
11_master_bedroom.jpg
reference_floorplan_2d.png
reference_floorplan_3d.png
```

The floor plans are planning references. The current Runway scene list uses the photographic/render anchor assigned to each shot.

## Commands

```bash
npm run validate       # verifies required local source assets and basic dimensions
npm run scene:list     # prints the locked shot list
npm run typecheck      # TypeScript validation
```

Generation and final assembly commands are scaffolded as subsequent stages only after S0 asset validation.
