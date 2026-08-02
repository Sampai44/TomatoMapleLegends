export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const { isAdmin } = useAuth()
  if (!isAdmin.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
