<script setup lang="ts">
import type { TrackPoint } from '~/utils/activity'
import { hasGps } from '~/utils/activity'

const props = defineProps<{
  points: TrackPoint[]
}>()

const path = computed(() => {
  const pts = props.points.filter(hasGps)
  if (pts.length < 2) return ''

  const lats = pts.map((p) => p.lat!)
  const lons = pts.map((p) => p.lon!)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const pad = 0.08
  const w = 640
  const h = 360
  const spanLon = Math.max(maxLon - minLon, 1e-6)
  const spanLat = Math.max(maxLat - minLat, 1e-6)

  const proj = (lat: number, lon: number) => {
    const x = ((lon - minLon) / spanLon) * (1 - pad * 2) * w + pad * w
    const y = (1 - (lat - minLat) / spanLat) * (1 - pad * 2) * h + pad * h
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
