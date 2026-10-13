<script setup lang="ts">
import type { TrackPoint } from '~/utils/activity'
import { hasGps } from '~/utils/activity'

const props = defineProps<{
  points: TrackPoint[]
}>()

const W = 640
const H = 360
const PAD = 0.08

const path = computed(() => {
  const pts = props.points.filter(hasGps)
  if (pts.length < 2) return ''

  const lats = pts.map((p) => p.lat!)
  const lons = pts.map((p) => p.lon!)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180)
  const cosLat = Math.max(Math.cos(midLat), 1e-6)

  // Equirectangular meters-ish units so lon isn't stretched vs lat
  const geoW = Math.max((maxLon - minLon) * cosLat, 1e-9)
  const geoH = Math.max(maxLat - minLat, 1e-9)

  const availW = W * (1 - PAD * 2)
  const availH = H * (1 - PAD * 2)
  const scale = Math.min(availW / geoW, availH / geoH)
  const drawW = geoW * scale
  const drawH = geoH * scale
  const offsetX = (W - drawW) / 2
  const offsetY = (H - drawH) / 2

  const proj = (lat: number, lon: number) => {
    const x = offsetX + (lon - minLon) * cosLat * scale
    const y = offsetY + (maxLat - lat) * scale
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }

  return pts.map((p) => proj(p.lat!, p.lon!)).join(' ')
})
</script>

<template>
  <div class="preview">
    <svg viewBox="0 0 640 360" role="img" aria-label="Track preview">
      <polyline
        v-if="path"
        :points="path"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <text v-else x="320" y="180" text-anchor="middle" fill="currentColor" opacity="0.5">
        No GPS to preview
      </text>
    </svg>
  </div>
</template>

<style scoped>
.preview {
  border-radius: 18px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(212, 255, 74, 0.05), transparent),
    rgba(0, 0, 0, 0.25);
  border: 1px solid var(--line);
  color: var(--accent);
}

svg {
  display: block;
  width: 100%;
  height: auto;
}
</style>
