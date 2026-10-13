<script setup lang="ts">
import type { LatLngExpression, Map as LeafletMap, Polyline as LeafletPolyline } from 'leaflet'
import type { TrackPoint } from '~/utils/activity'
import { hasGps } from '~/utils/activity'

const props = defineProps<{
  points: TrackPoint[]
}>()

const container = ref<HTMLElement | null>(null)
const empty = computed(() => props.points.filter(hasGps).length < 2)

let map: LeafletMap | null = null
let outline: LeafletPolyline | null = null
let line: LeafletPolyline | null = null
let L: typeof import('leaflet') | null = null
let resizeObserver: ResizeObserver | null = null

function latLngs(): LatLngExpression[] {
  return props.points.filter(hasGps).map((p) => [p.lat!, p.lon!] as LatLngExpression)
}

async function ensureMap() {
  if (!import.meta.client || !container.value || map) return

  const mod = await import('leaflet')
  L = (mod as { default?: typeof import('leaflet') }).default ?? mod
  await import('leaflet/dist/leaflet.css')

  map = L.map(container.value, {
    scrollWheelZoom: true,
    touchZoom: true,
    doubleClickZoom: true,
    boxZoom: true,
    keyboard: true,
    attributionControl: true,
  })

  // Keep wheel / pinch on the map instead of scrolling or zooming the page
  container.value.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
    },
    { passive: false },
  )
  container.value.addEventListener(
    'gesturestart',
    (e) => {
      e.preventDefault()
    },
    { passive: false },
  )

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  resizeObserver = new ResizeObserver(() => {
    map?.invalidateSize({ animate: false })
  })
  resizeObserver.observe(container.value)
}

function syncTrack() {
  if (!map || !L) return

  const pts = latLngs()
  if (pts.length < 2) {
    outline?.remove()
    line?.remove()
    outline = null
    line = null
    return
  }

  if (!line || !outline) {
    outline?.remove()
    line?.remove()
    // Dark halo so the track stays readable on pale OSM tiles
    outline = L.polyline(pts, {
      color: '#1a0a14',
      weight: 7,
      opacity: 0.85,
      lineJoin: 'round',
      lineCap: 'round',
      interactive: false,
    }).addTo(map)
    line = L.polyline(pts, {
      color: '#ff3d8a',
      weight: 3.5,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map)
  } else {
    outline.setLatLngs(pts)
    line.setLatLngs(pts)
  }

  map.invalidateSize({ animate: false })
  map.fitBounds(line.getBounds(), { padding: [28, 28], maxZoom: 16 })
}

onMounted(async () => {
  await ensureMap()
  syncTrack()
})

watch(
  () => props.points,
  async () => {
    await ensureMap()
    syncTrack()
  },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  outline = null
  line = null
  L = null
})
</script>

<template>
  <div class="preview" role="img" aria-label="Merged run map preview">
    <div ref="container" class="map" />
    <p v-if="empty" class="empty">No GPS to preview</p>
  </div>
</template>

<style scoped>
.preview {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.25);
  min-height: 280px;
  aspect-ratio: 16 / 10;
}

.map {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #1a2b22;
  touch-action: none;
}

:deep(.leaflet-container) {
  touch-action: none;
  font: inherit;
}

.empty {
  position: absolute;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--muted);
  background: rgba(15, 26, 20, 0.72);
  pointer-events: none;
}

:deep(.leaflet-control-attribution) {
  background: rgba(15, 26, 20, 0.78);
  color: var(--muted);
  font-size: 10px;
}

:deep(.leaflet-control-attribution a) {
  color: var(--accent);
}

:deep(.leaflet-bar) {
  border: 1px solid var(--line);
  box-shadow: none;
}

:deep(.leaflet-bar a) {
  background: rgba(15, 26, 20, 0.92);
  color: var(--ink);
  border-bottom-color: var(--line);
  width: 28px;
  height: 28px;
  line-height: 28px;
}

:deep(.leaflet-bar a:hover) {
  background: rgba(30, 61, 46, 0.95);
  color: var(--accent);
}
</style>
