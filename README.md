# Strava Merge

Tool to merge a **phone** recording (base timeline) with a **watch** recording (extra sensors), score overlapping metrics, and export a Strava-safe **GPX** or **FIT**.

Parsing and merging run entirely in your browser. Optional **Upload to Strava** sends only the merged file to Strava (via a small server-side OAuth helper).

## Why

Mixing GPS points from two devices often creates teleports and Strava “bad GPS”. This app picks **one entire GPS source**, keeps the phone timeline, and time-aligns other metrics onto it.

## Setup

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Usage

1. Upload phone + watch `.gpx` or `.fit`.
2. Review quality scores for shared metrics and pick a source.
3. Exclusive metrics (e.g. phone cadence, watch HR) are included automatically.
4. Download merged GPX or FIT, or use **Upload to Strava** (if configured).

Local test files live in `samples/` (not served by the app):

- `Miglia_Spezzate` — phone (GPS + cadence)
- `Corsa_serale` — watch (GPS + heart rate)

## Strava upload (optional)

1. Create an API application at [Strava API settings](https://www.strava.com/settings/api).
2. Set **Authorization Callback Domain** to your host only (e.g. `localhost` or `nas.example.com`).
3. Copy `.env.example` → `.env` and set:

```bash
NUXT_PUBLIC_STRAVA_CLIENT_ID=…
NUXT_STRAVA_CLIENT_SECRET=…
# Optional override if needed behind a proxy:
# NUXT_STRAVA_REDIRECT_URI=https://nas.example.com/api/strava/callback
```

4. Restart the app. After a merge, use **Connect Strava**, then **Upload to Strava**.

The callback URL is `https://<host>/api/strava/callback`.

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
