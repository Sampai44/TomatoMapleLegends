<template>
  <div class="toast-stack" aria-live="polite">
    <button
      v-for="t in toasts"
      :key="t.id"
      type="button"
      class="toast"
      :class="'toast-' + t.type"
      @click="dismissToast(t.id)"
    >
      <span class="toast-ico" :aria-hidden="true">{{ t.type === 'success' ? '✓' : '✕' }}</span>
      <span>{{ t.message }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useToasts } from '~/composables/useToasts'

const { toasts, dismissToast } = useToasts()
</script>
