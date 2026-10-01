import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/warehouse' },
    {
      path: '/warehouse',
      name: 'warehouse',
      component: () => import('../views/WarehouseView.vue'),
    },
    {
      path: '/warehouse/registry',
      name: 'registry',
      component: () => import('../views/RegistryView.vue'),
    },
    {
      path: '/warehouse/requests',
      name: 'requests',
      component: () => import('../views/BookingRequestsView.vue'),
      props: { tab: 'active' },
    },
    {
      path: '/warehouse/journal',
      name: 'journal',
      component: () => import('../views/BookingRequestsView.vue'),
      props: { tab: 'journal' },
    },
    {
      path: '/warehouse/settings',
      name: 'warehouse-settings',
      component: () => import('../views/WarehouseSettingsView.vue'),
    },
    {
      path: '/equipment/:id',
      name: 'equipment',
      component: () => import('../views/EquipmentView.vue'),
      props: true,
    },
    {
      path: '/tmc/:id',
      name: 'tmc',
      component: () => import('../views/TmcView.vue'),
      props: true,
    },
    {
      path: '/tmc/:id/return',
      name: 'tmc-return',
      component: () => import('../views/TmcView.vue'),
      props: (route) => ({ id: String(route.params.id), mode: 'return' }),
    },
    { path: '/tmc', redirect: '/warehouse' },
  ],
})

export default router
