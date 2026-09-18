import router from '@adonisjs/core/services/router'

const InstanceInfoController = () => import('./instance-info.controller.js')

/** Public: onboarding and Réglages ping it without a session. */
router.get('/api/public/instance', [InstanceInfoController, 'show'])
