import { test } from '@japa/runner'
import { DiscoverTodoEntities } from '#application/home-assistant/discover-todo-entities.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import {
  FakeHomeAssistantLinkRepository,
  FakeHomeAssistantClient,
  FakeHostPolicy,
  FakeHouseholdRepository,
} from './fakes.js'

function ownerHousehold(): Household {
  const invite = InviteCode.create('ZZ999999')
  if (!invite.ok) throw new Error('bad fixture invite code')
  return Household.create({
    id: 'household-1',
    name: 'Foyer',
    ownerId: 'owner-1',
    ownerMemberId: 'member-1',
    inviteCode: invite.value,
    createdAt: new Date(),
  })
}

test.group('DiscoverTodoEntities', () => {
  test('rejects a non-owner', async ({ assert }) => {
    const useCase = new DiscoverTodoEntities(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'not-owner', householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_owner')
  })

  test('with inline credentials, discovers without needing a stored link', async ({ assert }) => {
    const useCase = new DiscoverTodoEntities(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient({
        entities: [{ entityId: 'todo.courses', friendlyName: 'Courses' }],
      }),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'tok',
    })
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value[0]!.entityId, 'todo.courses')
  })

  test('with no inline credentials and no stored link, fails with link_not_found', async ({
    assert,
  }) => {
    const useCase = new DiscoverTodoEntities(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'link_not_found')
  })

  test('with no inline credentials, uses the stored link', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    const urlResult = InstanceUrl.create('http://homeassistant.local:8123')
    if (!urlResult.ok) throw new Error('bad fixture')
    await links.save(
      HomeAssistantLink.create({
        id: 'link-1',
        householdId: 'household-1',
        instanceUrl: urlResult.value,
        token: 'stored-token',
        createdAt: new Date(),
      }),
    )
    const useCase = new DiscoverTodoEntities(
      links,
      new FakeHomeAssistantClient({
        entities: [{ entityId: 'todo.courses', friendlyName: 'Courses' }],
      }),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1' })
    assert.isTrue(result.ok)
  })
})
