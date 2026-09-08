import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const HaLinkController = () => import('./ha-link.controller.js')

router
  .group(() => {
    router.get('/settings/home-assistant', [HaLinkController, 'show'])
    router.put('/settings/home-assistant', [HaLinkController, 'update'])
    router.post('/settings/home-assistant/discover', [HaLinkController, 'discover'])
    router.patch('/settings/home-assistant', [HaLinkController, 'bind'])
    router.delete('/settings/home-assistant', [HaLinkController, 'destroy'])
    // Path lives under /api/shopping-items because that is what's being
    // synced, but this code belongs to the home-assistant context —
    // shopping-list stays unaware it is mirrored (design §6).
    router.post('/shopping-items/sync', [HaLinkController, 'sync'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
