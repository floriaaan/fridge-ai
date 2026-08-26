import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ShoppingItemController = () => import('./shopping-item.controller.js')

router
  .group(() => {
    router.get('/shopping-items', [ShoppingItemController, 'index'])
    router.post('/shopping-items', [ShoppingItemController, 'store'])
    router.patch('/shopping-items/:id', [ShoppingItemController, 'update'])
    router.delete('/shopping-items/:id', [ShoppingItemController, 'destroy'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
