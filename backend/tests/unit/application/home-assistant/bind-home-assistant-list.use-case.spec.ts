import { test } from '@japa/runner'
import { BindHomeAssistantList } from '#application/home-assistant/bind-home-assistant-list.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { FakeHomeAssistantLinkRepository, FakeHouseholdRepository, FIXED_CLOCK } from './fakes.js'

function ownerHousehold(): Household {
  const invite = InviteCode.create('ZZ999999')
  if (!invite.ok) throw new Error('bad fixture')
  return Household.create({
    id: 'household-1',
    name: 'Foyer',
    ownerId: 'owner-1',
    ownerMemberId: 'member-1',
    inviteCode: invite.value,
    createdAt: new Date(),
  })
}

async function seededLinks(): Promise<FakeHomeAssistantLinkRepository> {
  const links = new FakeHomeAssistantLinkRepository()
  const urlResult = InstanceUrl.create('http://homeassistant.local:8123')
  if (!urlResult.ok) throw new Error('bad fixture')
  await links.save(
    HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: urlResult.value,
      token: 'tok',
      createdAt: new Date(),
    }),
  )
  return links
}

test.group('BindHomeAssistantList', () => {
  test('rejects a non-owner', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(await seededLinks(), new FakeHouseholdRepository([ownerHousehold()]), FIXED_CLOCK)
    const result = await useCase.execute({ userId: 'not-owner', householdId: 'household-1', todoEntityId: 'todo.courses' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_owner')
  })

  test('fails with link_not_found when there is nothing to bind onto', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(
      new FakeHomeAssistantLinkRepository(),
      new FakeHouseholdRepository([ownerHousehold()]),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1', todoEntityId: 'todo.courses' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'link_not_found')
  })

  test('binds the entity id and name together', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(await seededLinks(), new FakeHouseholdRepository([ownerHousehold()]), FIXED_CLOCK)
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      todoEntityId: 'todo.courses',
      todoEntityName: 'Courses',
    })
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.equal(result.value.todoEntityId, 'todo.courses')
      assert.equal(result.value.todoEntityName, 'Courses')
    }
  })

  test('changes direction and enabled independently', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(await seededLinks(), new FakeHouseholdRepository([ownerHousehold()]), FIXED_CLOCK)
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1', direction: 'push', enabled: false })
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.equal(result.value.direction.value, 'push')
      assert.isFalse(result.value.enabled)
    }
  })

  test('rejects an invalid direction', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(await seededLinks(), new FakeHouseholdRepository([ownerHousehold()]), FIXED_CLOCK)
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1', direction: 'sideways' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'invalid_direction')
  })
})
