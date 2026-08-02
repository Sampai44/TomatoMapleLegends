<template>
  <header class="site-header">
    <div class="container-wide site-header-inner">
      <NuxtLink to="/" class="brand">
        <TomatoLogo />
        <span>TOMATO</span>
      </NuxtLink>
      <nav>
        <ul class="nav-links">
          <li><NuxtLink to="/">Home</NuxtLink></li>
          <li><NuxtLink to="/roster">Roster</NuxtLink></li>
          <li><NuxtLink to="/raids">Raids</NuxtLink></li>
          <li v-if="isAdmin"><NuxtLink to="/admin">Admin</NuxtLink></li>
          <li v-if="!me?.authed" class="nav-account">
            <NuxtLink to="/login">Log in</NuxtLink>
          </li>
          <li v-else class="nav-account">
            <NuxtLink to="/login" class="account-link">
              <span class="account-dot admin" />
              {{ me.charName ?? 'Account' }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
const { me, isAdmin } = useAuth()
</script>
