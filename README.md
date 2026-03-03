<div align="center">

# SignalMap

**Real-time campus event map for UNC Chapel Hill**

An interactive map that shows what's happening across 86 buildings right now — events, performances, lectures, athletics, and more — pulled live from 5 data sources.

[Getting Started](#getting-started) · [Data Sources](#data-sources) · [Architecture](#architecture) · [API](#api)

[![Demo Video](https://img.shields.io/badge/Demo-YouTube-red?style=for-the-badge&logo=youtube)](https://youtu.be/GdXsXGQV098)

</div>

---

## Demo

https://youtu.be/GdXsXGQV098

## Features

🗺️ **Interactive Map** — 1,236 building footprints from OpenStreetMap, clickable with fly-to zoom and 3D lift effect

🔥 **Heat-Level System** — Buildings colored by event urgency: gray → green → amber → orange → red, with breathing glow animations

🎓 **CLE Tracking** — Campus Life Experience credit events highlighted with blue indicators so you never miss graduation requirements

🔍 **Building Search** — Fuzzy search across building names and aliases

⏱️ **Auto-Refresh** — Data re-ingested every hour in the background; page always shows the latest

📱 **Bottom Panel** — Click any building to see happening-now and upcoming events with countdown timers

## Screenshots

> Run `npm run dev` and open `localhost:3000` to see the full UI.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Quick Setup (one command)

```bash
git clone https://github.com/Abbott400097/Signal-Map.git
cd Signal-Map
bash scripts/setup.sh
npm run dev
```

This installs deps, creates the database, seeds 86 buildings, and **pulls 580+ real events** from 5 live data sources. Then open **http://localhost:3000**.

### Manual Setup (step by step)

```bash
git clone https://github.com/Abbott400097/Signal-Map.git
cd Signal-Map
npm install
cp .env.example .env

# Initialize SQLite database (no external DB needed)
npx prisma migrate dev

# Seed 86 UNC buildings
npx prisma db seed
```

> **⚠️ Important — don't skip this step!**
> The seed only creates buildings + 7 demo events. You **must** run ingest to pull real data:

```bash
npm run ingest
```

This fetches **580+ real events** from Heel Life, UNC Calendar, Libraries, and Athletics. Takes about 30 seconds.

```bash
npm run dev
```

Open **http://localhost:3000**

## Data Sources

| Source | Type | Events | Coverage |
|--------|------|--------|----------|
| [Heel Life](https://heellife.unc.edu) | JSON API | ~440 | Student org events, CLE-tagged |
| [UNC Events Calendar](https://calendar.unc.edu) | Localist API | ~100 | University-wide events |
| [UNC Libraries](https://calendar.lib.unc.edu) | iCal feed | ~24 | Workshops, classes, lectures |
| [UNC Athletics](https://move.unc.edu) | iCal feed | ~13 | Game schedules |
| Carolina Performing Arts | WP REST API | varies | Performances (when available) |

**Total: 580+ events, 74% matched to buildings**

### Re-ingest manually

```bash
npm run ingest
```

Or hit the API endpoint:
```bash
curl http://localhost:3000/api/cron/ingest
```

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Server component — computes heat levels
│   ├── globals.css           # Full theme (parchment palette, animations)
│   ├── layout.tsx            # Fonts (Crimson Pro + Inter)
│   ├── building/[id]/        # Building detail page
│   └── api/
│       ├── events/           # GET events by building/date
│       ├── buildings/        # GET all buildings
│       └── cron/ingest/      # Trigger full re-ingest
├── components/
│   ├── map-panel.tsx         # Leaflet map + overlays + interactions
│   └── search-panel.tsx      # Building search dropdown
└── lib/
    ├── types.ts              # BuildingSummary, HeatLevel
    ├── events.ts             # Heat level computation
    ├── prisma.ts             # Prisma client singleton
    └── ingest/
        ├── service.ts        # Orchestrator — dispatches to parsers
        ├── normalizer.ts     # Building matching (name + coordinates)
        ├── heellife-parser.ts
        ├── unc-calendar-parser.ts
        ├── ical-parser.ts    # Generic iCal (libraries + athletics)
        └── cpa-parser.ts     # Carolina Performing Arts

prisma/
├── schema.prisma             # Building, Event, EventSource, IngestLog
├── seed.ts                   # 86 buildings + demo events + sources
└── migrations/

public/
└── buildings.geojson         # 1,236 OSM building polygons
```

### Heat Levels

| Level | Condition | Color | Effect |
|-------|-----------|-------|--------|
| T4 | Happening now | 🔴 Red | 2.5s pulse |
| T3 | Within 3 hours | 🟠 Orange | 3.5s pulse |
| T2 | Within 6 hours | 🟡 Amber | 5s pulse |
| T1 | Later today | 🟢 Green | 7s glow |
| T0 | No events | ⚪ Gray | None |
| CLE | Has CLE credit events | 🔵 Blue dashed border | — |

### Tech Stack

- **Next.js 15** + React 19 (App Router, Server Components)
- **Leaflet** + CARTO Voyager tiles (free, no API key)
- **Prisma** + SQLite (zero-config local DB)
- **TypeScript** end-to-end

## API

### `GET /api/events`

Query events by building and time window.

| Param | Type | Default |
|-------|------|---------|
| `buildingId` | CUID | — |
| `from` | ISO date | now |
| `to` | ISO date | now + 3 days |
| `category` | string | — |

### `GET /api/buildings`

Returns all buildings with coordinates and campus info.

### `GET /api/cron/ingest`

Triggers a full re-ingest of all data sources. Returns counts of new/updated events.

## Roadmap

- [ ] Course schedule integration (find your classmates)
- [ ] Task marketplace (delivery between north/south campus)
- [ ] Push notifications for CLE events near you
- [ ] Mobile-optimized layout
- [ ] Vercel deployment with cron

## License

MIT

---

<div align="center">
Built for UNC Chapel Hill 🐏
</div>
