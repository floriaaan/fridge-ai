import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import {
  createShoppingItemValidator,
  updateShoppingItemValidator,
} from './shopping-item.validator.js'
import { toShoppingItemDto } from './shopping-item.dto.js'
import { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'
import { ListShoppingItems } from '#application/shopping-list/list-shopping-items.use-case'
import { UpdateShoppingItem } from '#application/shopping-list/update-shopping-item.use-case'
import { DeleteShoppingItem } from '#application/shopping-list/delete-shopping-item.use-case'

export default class ShoppingItemController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const items = await ctx.containerResolver.make('shoppingList.items')
    const result = await new ListShoppingItems(items).execute({ householdId: ctx.household.id })
    return ctx.response.json({ items: result.map(toShoppingItemDto) })
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(createShoppingItemValidator)
    const items = await ctx.containerResolver.make('shoppingList.items')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
    const clock = await ctx.containerResolver.make('shared.clock')

    const result = await new CreateShoppingItem(items, idGenerator, clock).execute({
      householdId: ctx.household.id,
      ...payload,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ item: toShoppingItemDto(result.value) })
  }

  async update(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(updateShoppingItemValidator)
    const items = await ctx.containerResolver.make('shoppingList.items')
    const clock = await ctx.containerResolver.make('shared.clock')

    const result = await new UpdateShoppingItem(items, clock).execute({
      householdId: ctx.household.id,
      itemId: ctx.params.id,
      ...payload,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ item: toShoppingItemDto(result.value) })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const items = await ctx.containerResolver.make('shoppingList.items')
    const result = await new DeleteShoppingItem(items).execute({
      householdId: ctx.household.id,
      itemId: ctx.params.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(204).send('')
  }
}
