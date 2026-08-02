<template>
  <div>
    <SiteHeader />
    <main>
      <NuxtPage />
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  ogSiteName: 'Tomato — MapleLegends Guild',
  ogType: 'website',
  ogTitle: 'Tomato — MapleLegends Guild',
  ogDescription: 'Tomato is a guild on the MapleLegends private server. Browse our roster, track member progress and stats.'
})
</script>
