<script setup lang="ts">
import type { MergeChoices, SourceChoice } from '~/utils/activity'
import { METRIC_LABELS } from '~/utils/activity'
import type { SharedChannelDecision } from '~/utils/merge'

const props = defineProps<{
  decisions: SharedChannelDecision[]
  choices: MergeChoices
}>()

const emit = defineEmits<{
  'update:choices': [value: MergeChoices]
}>()

const shared = computed(() => props.decisions.filter((d) => d.shared))
const exclusive = computed(() =>
  props.decisions.filter((d) => !d.shared && (d.phonePresent || d.watchPresent)),
)

function setSource(channel: keyof MergeChoices, value: SourceChoice) {
  emit('update:choices', { ...props.choices, [channel]: value })
}

function setStrip(value: boolean) {
  emit('update:choices', { ...props.choices, stripTeleports: value })
}
</script>

<template>
  <section class="picker">
    <header>
      <h2>Choose sources</h2>
      <p>Phone is the timeline base. Shared metrics need a pick; exclusives are included automatically.</p>
    </header>

    <div v-if="shared.length" class="stack">
      <article v-for="d in shared" :key="d.channel" class="row">
        <div>
          <h3>{{ METRIC_LABELS[d.channel] }}</h3>
          <p class="reason">
            Phone {{ d.phoneScore }} — {{ d.phoneReason }}
            <br>
            Watch {{ d.watchScore }} — {{ d.watchReason }}
          </p>
          <span class="rec">Suggested: {{ d.recommended }}</span>
        </div>
        <div class="toggle">
          <button
            type="button"
            :class="{ active: choices[d.channel as keyof MergeChoices] === 'phone' }"
            @click="setSource(d.channel as keyof MergeChoices, 'phone')"
          >
            Phone {{ d.phoneScore }}
          </button>
          <button
            type="button"
            :class="{ active: choices[d.channel as keyof MergeChoices] === 'watch' }"
            @click="setSource(d.channel as keyof MergeChoices, 'watch')"
          >
            Watch {{ d.watchScore }}
          </button>
        </div>
      </article>
    </div>

    <div v-if="exclusive.length" class="exclusive">
      <h3>Auto-included</h3>
      <ul>
        <li v-for="d in exclusive" :key="d.channel">
          <strong>{{ METRIC_LABELS[d.channel] }}</strong>
          from {{ d.phonePresent ? 'phone' : 'watch' }}
          (score {{ d.phonePresent ? d.phoneScore : d.watchScore }})
        </li>
      </ul>
    </div>

    <label class="strip">
      <input
        type="checkbox"
        :checked="choices.stripTeleports"
        @change="setStrip(($event.target as HTMLInputElement).checked)"
      >
      Strip teleport GPS spikes before export
    </label>
  </section>
</template>

<style scoped>
.picker {
  display: grid;
  gap: 1rem;
}

header h2,
.exclusive h3,
.row h3 {
  font-family: var(--font-display);
  margin: 0 0 0.35rem;
}

header p,
.reason {
  margin: 0;
  color: var(--muted);
  line-height: 1.45;
}

.stack {
  display: grid;
  gap: 0.75rem;
}

.row {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--card);
}

@media (min-width: 800px) {
  .row {
    grid-template-columns: 1fr auto;
    align-items: center;
  }
}

.rec {
  display: inline-block;
  margin-top: 0.55rem;
  color: var(--ok);
  font-size: 0.85rem;
}

.toggle {
  display: flex;
  gap: 0.5rem;
}

.toggle button {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  border-radius: 999px;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
}

.toggle button.active {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
}

.exclusive ul {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--muted);
}

.strip {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  color: var(--muted);
}
</style>
