import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  saveHomeAssistantConnectionValidator,
  discoverTodoEntitiesValidator,
  bindHomeAssistantListValidator,
} from './ha-link.validator.js'
import { toHomeAssistantLinkDto } from './ha-link.dto.js'
import { GetHomeAssistantLink } from '#application/home-assistant/get-home-assistant-link.use-case'
import { SaveHomeAssistantConnection } from '#application/home-assistant/save-home-assistant-connection.use-case'
import { DiscoverTodoEntities } from '#application/home-assistant/discover-todo-entities.use-case'
import { BindHomeAssistantList } from '#application/home-assistant/bind-home-assistant-list.use-case'
import { UnlinkHomeAssistant } from '#application/home-assistant/unlink-home-assistant.use-case'
import { SyncShoppingList } from '#application/home-assistant/sync-shopping-list.use-case'

export default class HaLinkController {
  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', GetHomeAssistantLink, async () => {
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const result = await new GetHomeAssistantLink(links).execute({ householdId: ctx.household.id })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json(toHomeAssistantLinkDto(result.value))
      return result
    }, { isError: (r) => !r.ok })
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', SaveHomeAssistantConnection, async () => {
      const payload = await ctx.request.validateUsing(saveHomeAssistantConnectionValidator)
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const client = await ctx.containerResolver.make('homeAssistant.client')
      const hostPolicy = await ctx.containerResolver.make('homeAssistant.hostPolicy')
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new SaveHomeAssistantConnection(
        links,
        client,
        hostPolicy,
        households,
        idGenerator,
        clock,
      ).execute({
        userId: user.id,
        householdId: ctx.household.id,
        instanceUrl: payload.instanceUrl,
        token: payload.token ?? '',
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json(toHomeAssistantLinkDto(result.value))
      return result
    }, { isError: (r) => !r.ok })
  }

  async discover(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', DiscoverTodoEntities, async () => {
      const payload = await ctx.request.validateUsing(discoverTodoEntitiesValidator)
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const client = await ctx.containerResolver.make('homeAssistant.client')
      const hostPolicy = await ctx.containerResolver.make('homeAssistant.hostPolicy')
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new DiscoverTodoEntities(links, client, hostPolicy, households).execute({
        userId: user.id,
        householdId: ctx.household.id,
        instanceUrl: payload.instanceUrl,
        token: payload.token,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json({ entities: result.value })
      return result
    }, { isError: (r) => !r.ok })
  }

  async bind(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', BindHomeAssistantList, async () => {
      const payload = await ctx.request.validateUsing(bindHomeAssistantListValidator)
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const households = await ctx.containerResolver.make('identity.households')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new BindHomeAssistantList(links, households, clock).execute({
        userId: user.id,
        householdId: ctx.household.id,
        ...payload,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json(toHomeAssistantLinkDto(result.value))
      return result
    }, { isError: (r) => !r.ok })
  }

  async destroy(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', UnlinkHomeAssistant, async () => {
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const items = await ctx.containerResolver.make('shoppingList.items')
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new UnlinkHomeAssistant(links, items, households).execute({
        userId: user.id,
        householdId: ctx.household.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }

  async sync(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', SyncShoppingList, async () => {
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const items = await ctx.containerResolver.make('shoppingList.items')
      const client = await ctx.containerResolver.make('homeAssistant.client')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new SyncShoppingList(links, items, client, idGenerator, clock).execute({
        householdId: ctx.household.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json(result.value)
      return result
    }, { isError: (r) => !r.ok })
  }
}
