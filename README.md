# Workout Tracker

A fast, offline-first PWA for logging lifts — built for Benjamin & Rob. When you're
about to do an exercise, it shows your **last weight** and your **record** front and
center so you can pick today's weight with confidence.

## Features

- **Last & Record at a glance** — every exercise card shows your last set (weight × reps,
  with date) and your all-time max weight + estimated 1RM.
- **Fast set logging** — big number pads, weight pre-filled from last time, tap ✓ to mark
  a set done. Add sets/exercises on the fly.
- **Routines** — reusable templates (Push / Pull / Legs seeded) to start a workout in a tap;
  still fully editable mid-session so you can switch things up.
- **Two profiles** — Benjamin & Rob (add more), each with their own log; shared exercise
  catalog and routines.
- **Exercise history** — per-exercise records, an est-1RM trend sparkline, and full history.
- **Offline-first** — all data is stored on-device (localStorage) and works with no signal.
  Installable to your phone's home screen as a full-screen app.
- **Backup & move** — export/import your data as a JSON file (Settings tab).

Seeded from Benjamin's 2025–26 training log so records and history are populated on day one.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
```

## Deploy

Pushing to `main` triggers the GitHub Actions workflow in `.github/workflows/deploy.yml`,
which builds and publishes to GitHub Pages. The build reads the repo base path from the
`VITE_BASE` Actions **Variable** (e.g. `/workout-tracker/`).

## Data model

Shared catalog of `exercises` and `routines`; per-profile `sessions` (each with dated
`entries` → `sets` of weight × reps) plus an in-progress `draft`. All records (max weight,
estimated 1RM via Epley) are computed from session history at render time.
