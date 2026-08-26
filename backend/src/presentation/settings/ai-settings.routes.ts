import router from '@adonisjs/core/services/router'

const AiSettingsController = () => import('./ai-settings.controller.js')

router.get('/api/settings/ai', [AiSettingsController, 'show'])
router.patch('/api/settings/ai', [AiSettingsController, 'update'])
