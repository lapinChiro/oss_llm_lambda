<script setup lang="ts">
defineProps<{
  kind: 'loading' | 'empty' | 'error'
  message?: string
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="state" :aria-live="kind === 'loading' ? 'polite' : 'assertive'">
    <p v-if="kind === 'loading'">Loading todos…</p>
    <p v-else-if="kind === 'empty'">No todos yet. Add one to get started.</p>
    <template v-else>
      <p>{{ message }}</p>
      <button type="button" @click="$emit('retry')">Try again</button>
    </template>
  </section>
</template>
