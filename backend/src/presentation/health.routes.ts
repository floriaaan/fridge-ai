import router from '@adonisjs/core/services/router'

router.get('/health', async ({ response }) => {
  return response.json({ status: 'ok' })
})
