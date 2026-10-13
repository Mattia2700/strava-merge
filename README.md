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

- `Miglia_Spezzate` — phone (GPS + cadence)
- `Corsa_serale` — watch (GPS + heart rate)

## Docker / NAS

Build and run locally or on a NAS:

```bash
docker compose up -d --build
```

App listens on `http://<host>:3000`.

### GitHub Container Registry

Pushing to `main`/`master` (or a `v*` tag) runs [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml) and publishes:

`ghcr.io/<user-or-org>/strava-merge:latest`

Multi-arch: `linux/amd64` + `linux/arm64` (typical x86 NAS and ARM Synology).

On the NAS, set in `docker-compose.yml`:

```yaml
image: ghcr.io/<user-or-org>/strava-merge:latest
```

and either make the GHCR package public, or `docker login ghcr.io` with a PAT that can read packages.
