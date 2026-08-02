<template>
  <section class="section">
    <div class="container-narrow">
      <h1 class="section-title">Jr master access</h1>

      <div v-if="me?.authed" class="card account-card">
        <div class="bind-status">
          <span class="status-dot ok" />
          <div>
            <strong>{{ me.charName ?? me.email }}</strong>
            <span class="role-chip admin">{{ me.guildRank ?? 'Master' }}</span>
            <span v-if="!me.isAdmin" class="form-error inline-note">
              Your IGN is not a current guild Master / Jr. Master in the roster — the admin
              panel won't work until it is.
            </span>
          </div>
        </div>

        <div class="account-actions">
          <NuxtLink to="/raids" class="btn btn-cream">View raids</NuxtLink>
          <NuxtLink v-if="me.isAdmin" to="/admin" class="btn btn-red">Admin panel</NuxtLink>
          <button class="btn btn-outline" @click="signOut">Log out</button>
        </div>
      </div>

      <div v-else class="card account-card">
        <h2>Log in</h2>
        <p class="bind-hint">
          Accounts are reserved for the guild Master and Jr. Masters. Sign in with your
          in-game name and the guild's shared password.
        </p>
        <form class="auth-form" @submit.prevent="submitAuth">
          <label>
            In-game name
            <input v-model="ign" type="text" maxlength="20" autocomplete="username" placeholder="e.g. tomatofren" required />
          </label>
          <label>
            Password
            <input v-model="password" type="password" autocomplete="current-password" required />
          </label>
          <p v-if="authError" class="form-error">{{ authError }}</p>
          <button class="btn btn-red" type="submit" :disabled="authBusy">
            {{ authBusy ? 'Please wait…' : 'Log in' }}
          </button>
        </form>
        <p class="auth-note">
          No account? Members don't need one — sign up for raids directly with your IGN.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'

useSeoMeta({
  title: 'Jr master login — Tomato Guild',
  ogTitle: 'Jr master login — Tomato Guild'
})

const { me, isAdmin, signIn, signOut } = useAuth()

const route = useRoute()
const ign = ref('')
const password = ref('')
const authBusy = ref(false)
const authError = ref('')

async function submitAuth() {
  authBusy.value = true
  authError.value = ''
  try {
    await signIn(ign.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/raids'
    navigateTo(redirect)
  } catch (e: any) {
    authError.value = e?.message ?? 'Something went wrong'
  } finally {
    authBusy.value = false
  }
}
</script>
