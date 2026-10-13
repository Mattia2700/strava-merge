# Strava Merge

Browser-only tool to merge a **phone** recording (base timeline) with a **watch** recording (extra sensors), score overlapping metrics, and export a Strava-safe **GPX** or **FIT**.

Files never leave your browser.

## Why

Mixing GPS points from two devices often creates teleports and Strava “bad GPS”. This app picks **one entire GPS source**, keeps the phone timeline, and time-aligns other metrics onto it.

## Setup

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Usage

1. Upload phone + watch `.gpx` or `.fit` (or click **Try sample run**).
2. Review quality scores for shared metrics and pick a source.
3. Exclusive metrics (e.g. phone cadence, watch HR) are included automatically.
4. Download merged GPX or FIT and upload to Strava.

Sample files in `samples/` / `public/samples/`:

- `Miglia_Spezzate.gpx` — phone (GPS + cadence)
- `Corsa_serale.gpx` — watch (GPS + heart rate)
