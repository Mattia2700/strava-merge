<script setup lang="ts">
import type { ActivityStream, MergeChoices } from '~/utils/activity'
import {
  durationMs,
  formatDuration,
  METRIC_LABELS,
} from '~/utils/activity'
import {
  analyzeOverlap,
  defaultMergeChoices,
  mergeActivities,
  type SharedChannelDecision,
} from '~/utils/merge'
import { parseActivityFile } from '~/utils/parseFile'
import { downloadGpx } from '~/utils/exportGpx'
import { downloadFit } from '~/utils/exportFit'
import { channelPresent } from '~/utils/activity'

useHead({
  title: 'Strava Merge',
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@500;600;700&display=swap',
    },
  ],
})

const phone = ref<ActivityStream | null>(null)
const watch = ref<ActivityStream | null>(null)
const phoneName = ref('')
const watchName = ref('')
const choices = ref<MergeChoices | null>(null)
const decisions = ref<SharedChannelDecision[]>([])
const merged = ref<ActivityStream | null>(null)
const error = ref('')
const busy = ref(false)
const busyLabel = ref('')
let mergeToken = 0

const mergedStats = computed(() => {
  if (!merged.value) return null
  const pts = merged.value.points
  const metrics = (['hr', 'cad', 'power', 'ele', 'speed', 'temp'] as const)
    .filter((k) => channelPresent(pts, k))
    .map((k) => METRIC_LABELS[k])
  return {
    points: pts.length,
    duration: formatDuration(durationMs(merged.value)),
    metrics,
  }
})

async function yieldToUi() {
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function rebuildMerged() {
  const token = ++mergeToken
  if (!phone.value || !watch.value || !choices.value) {
    merged.value = null
    return
  }

  busy.value = true
  busyLabel.value = 'Merging…'
  await yieldToUi()

  try {
    const result = mergeActivities(phone.value, watch.value, choices.value)
    if (token === mergeToken) merged.value = result
  } finally {
    if (token === mergeToken) {
      busy.value = false
      busyLabel.value = ''
    }
  }
}

async function loadSide(side: 'phone' | 'watch', file: File) {
  error.value = ''
  busy.value = true
  busyLabel.value = `Parsing ${file.name}…`
  try {
    await yieldToUi()
    const stream = await parseActivityFile(file, side)
    if (side === 'phone') {
      phone.value = stream
      phoneName.value = file.name
    } else {
      watch.value = stream
      watchName.value = file.name
    }
    refreshChoices()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to parse file'
  } finally {
    busy.value = false
    busyLabel.value = ''
  }

  if (phone.value && watch.value && choices.value) {
    await rebuildMerged()
  }
}

function refreshChoices() {
  if (!phone.value || !watch.value) {
    choices.value = null
    decisions.value = []
    merged.value = null
    return
  }
  decisions.value = analyzeOverlap(phone.value, watch.value)
  choices.value = defaultMergeChoices(phone.value, watch.value)
}

function onChoicesUpdate(next: MergeChoices) {
  choices.value = next
  void rebuildMerged()
}

function summary(stream: ActivityStream | null) {
  if (!stream) return null
  const present = (['gps', 'ele', 'hr', 'cad', 'power', 'speed', 'temp'] as const)
    .filter((k) => channelPresent(stream.points, k))
    .map((k) => METRIC_LABELS[k])
  return {
    name: stream.name,
    points: stream.points.length,
    duration: formatDuration(durationMs(stream)),
    metrics: present,
  }
}

const phoneSummary = computed(() => summary(phone.value))
const watchSummary = computed(() => summary(watch.value))
</script>

<template>
  <main class="page">
    <section class="hero">
      <p class="brand">Strava Merge</p>
      <h1>Phone base. Watch extras. Clean export.</h1>
      <p class="lede">
        Merge a phone recording with a watch recording, score overlapping metrics,
        and download a Strava-safe GPX or FIT without mixed-GPS teleports.
      </p>
    </section>

    <section class="uploads">
      <FileDrop
        label="Phone"
        hint="Base timeline + GPS preference"
        :file-name="phoneName || undefined"
        @file="loadSide('phone', $event)"
      />
      <FileDrop
        label="Watch"
        hint="Heart rate and other sensors"
        :file-name="watchName || undefined"
        @file="loadSide('watch', $event)"
      />
    </section>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="busy" class="busy">{{ busyLabel || 'Working…' }}</p>

    <section v-if="phoneSummary || watchSummary" class="summaries">
      <article v-if="phoneSummary">
        <h2>Phone</h2>
        <p>{{ phoneSummary.name }}</p>
        <ul>
          <li>{{ phoneSummary.points }} points</li>
          <li>{{ phoneSummary.duration }}</li>
          <li>{{ phoneSummary.metrics.join(' · ') }}</li>
        </ul>
      </article>
      <article v-if="watchSummary">
        <h2>Watch</h2>
        <p>{{ watchSummary.name }}</p>
        <ul>
          <li>{{ watchSummary.points }} points</li>
          <li>{{ watchSummary.duration }}</li>
          <li>{{ watchSummary.metrics.join(' · ') }}</li>
        </ul>
      </article>
    </section>

    <SourcePicker
      v-if="choices && decisions.length"
      :decisions="decisions"
      :choices="choices"
      @update:choices="onChoicesUpdate"
    />

    <section v-if="merged && mergedStats" class="result">
      <div class="result-copy">
        <h2>Merged preview</h2>
        <p>
          {{ mergedStats.points }} points · {{ mergedStats.duration }}
          <template v-if="mergedStats.metrics.length">
            · {{ mergedStats.metrics.join(' · ') }}
          </template>
        </p>
        <div class="downloads">
          <button type="button" class="primary" @click="downloadGpx(merged)">
            Download GPX
          </button>
          <button type="button" class="ghost" @click="downloadFit(merged)">
            Download FIT
          </button>
        </div>
      </div>
      <TrackPreview :points="merged.points" />
    </section>
  </main>
</template>

<style scoped>
.page {
  width: min(1100px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2.5rem 0 4rem;
  display: grid;
  gap: 1.75rem;
}

.hero {
  display: grid;
  gap: 0.75rem;
  padding: 1.5rem 0 0.5rem;
}

.brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 6vw, 3.4rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  color: var(--accent);
}

h1 {
  margin: 0;
  max-width: 16ch;
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 3.5vw, 2rem);
  font-weight: 600;
  line-height: 1.15;
}

.lede {
  margin: 0;
  max-width: 52ch;
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.55;
}

.downloads {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.uploads,
.summaries {
  display: grid;
  gap: 0.85rem;
}

@media (min-width: 760px) {
  .uploads,
  .summaries {
    grid-template-columns: 1fr 1fr;
  }
}

.summaries article,
.result {
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--card);
  padding: 1rem 1.1rem;
}

.summaries h2,
.result h2 {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
}

.summaries p,
.result p {
  margin: 0;
  color: var(--muted);
}

.summaries ul {
  margin: 0.7rem 0 0;
  padding-left: 1.1rem;
  color: var(--ink);
}

.result {
  display: grid;
  gap: 1rem;
}

@media (min-width: 860px) {
  .result {
    grid-template-columns: 0.9fr 1.1fr;
    align-items: center;
  }
}

.result-copy {
  display: grid;
  gap: 0.75rem;
}

button {
  border-radius: 999px;
  border: 1px solid var(--line);
  padding: 0.7rem 1.1rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.primary {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
  font-weight: 600;
}

button.ghost {
  background: transparent;
  color: var(--ink);
}

.error {
  color: var(--warn);
  margin: 0;
}

.busy {
  margin: 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.9rem;
}
</style>
