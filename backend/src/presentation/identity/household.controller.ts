import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import { createHouseholdValidator, joinHouseholdValidator } from './household.validator.js'
import { toHouseholdDto } from './household.dto.js'
import { CreateHousehold } from '#application/identity/create-household.use-case'
import { JoinHousehold } from '#application/identity/join-household.use-case'
import { GetMyHousehold } from '#application/identity/get-my-household.use-case'
import { RegenerateInviteCode } from '#application/identity/regenerate-invite-code.use-case'
import { RemoveHouseholdMember } from '#application/identity/remove-household-member.use-case'
import { LeaveHousehold } from '#application/identity/leave-household.use-case'
import { DeleteHousehold } from '#application/identity/delete-household.use-case'

export default class HouseholdController {
  async mine(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', GetMyHousehold, async () => {
      const households = await ctx.containerResolver.make('identity.households')
      const userDirectory = await ctx.containerResolver.make('identity.userDirectory')

      const household = await new GetMyHousehold(households).execute({ userId: user.id })
      if (!household) {
        ctx.response.json({ household: null })
        return
      }

      const members = await userDirectory.findByIds(household.members.map((m) => m.userId))
      ctx.response.json({ household: toHouseholdDto(household, user.id, members) })
    })
  }

  async create(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', CreateHousehold, async () => {
      const payload = await ctx.request.validateUsing(createHouseholdValidator)
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')
      const userDirectory = await ctx.containerResolver.make('identity.userDirectory')

      const result = await new CreateHousehold(households, idGenerator, clock).execute({
        userId: user.id,
        name: payload.name,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      const members = await userDirectory.findByIds([user.id])
      ctx.response.status(201).json({ household: toHouseholdDto(result.value, user.id, members) })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.id : undefined) })
  }

  async join(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', JoinHousehold, async () => {
      const payload = await ctx.request.validateUsing(joinHouseholdValidator)
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')
      const userDirectory = await ctx.containerResolver.make('identity.userDirectory')

      const result = await new JoinHousehold(households, idGenerator, clock).execute({
        userId: user.id,
        inviteCode: payload.inviteCode,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      const members = await userDirectory.findByIds(result.value.members.map((m) => m.userId))
      ctx.response.json({ household: toHouseholdDto(result.value, user.id, members) })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.id : undefined) })
  }

  async regenerateInviteCode(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', RegenerateInviteCode, async () => {
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')

      const result = await new RegenerateInviteCode(households, idGenerator).execute({
        userId: user.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.json({ inviteCode: result.value.inviteCode.value })
      return result
    }, { isError: (r) => !r.ok })
  }

  async removeMember(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', RemoveHouseholdMember, async () => {
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new RemoveHouseholdMember(households).execute({
        userId: user.id,
        targetUserId: ctx.params.userId,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.status(204).send('')
      return result
      // `:userId`, not `:id` — this route names its param differently, so
      // traceAction's free `ctx.params.id` lookup would miss it entirely.
    }, { isError: (r) => !r.ok, entityId: () => ctx.params.userId })
  }

  async leave(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', LeaveHousehold, async () => {
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new LeaveHousehold(households).execute({ userId: user.id })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }

  async destroy(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', DeleteHousehold, async () => {
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new DeleteHousehold(households).execute({ userId: user.id })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }
}
