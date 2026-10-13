<script setup lang="ts">
const props = defineProps<{
  label: string
  hint: string
  fileName?: string
}>()

const emit = defineEmits<{
  file: [file: File]
}>()

const dragging = ref(false)

function onFiles(list: FileList | null) {
  const file = list?.[0]
  if (!file) return
  emit('file', file)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  onFiles(e.dataTransfer?.files ?? null)
}
</script>

<template>
  <label
    class="drop"
    :class="{ dragging }"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <span class="eyebrow">{{ label }}</span>
    <strong>{{ fileName || 'Drop .gpx / .fit' }}</strong>
    <span class="hint">{{ hint }}</span>
    <input
      type="file"
      accept=".gpx,.fit,application/gpx+xml,application/octet-stream"
      hidden
      @change="onFiles(($event.target as HTMLInputElement).files)"
    >
  </label>
</template>

<style scoped>
.drop {
  display: grid;
  gap: 0.35rem;
  padding: 1.25rem;
  border: 1px dashed var(--line);
  border-radius: 18px;
  background: var(--card);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.drop:hover,
.drop.dragging {
  border-color: var(--accent);
  background: rgba(212, 255, 74, 0.06);
  transform: translateY(-1px);
}

.eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

strong {
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.hint {
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
