import router from '@adonisjs/core/services/router'

const PublicStatsController = () => import('./public-stats.controller.js')

/** Public: the landing page reads it without a session. */
router.get('/api/public/stats', [PublicStatsController, 'show'])
