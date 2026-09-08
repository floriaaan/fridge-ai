import { test } from '@japa/runner'
import { SaveHomeAssistantConnection } from '#application/home-assistant/save-home-assistant-connection.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import {
  FakeHomeAssistantLinkRepository,
  FakeHomeAssistantClient,
  FakeHostPolicy,
  FakeHouseholdRepository,
  FIXED_CLOCK,
  SEQUENTIAL_IDS,
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

test.group('SaveHomeAssistantConnection', () => {
  test('rejects a non-owner', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'not-the-owner',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'tok',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_owner')
  })

  test('rejects an invalid URL', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'not a url',
      token: 'tok',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'invalid_url')
  })

  test('rejects a disallowed host', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(false),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://evil.example.com',
      token: 'tok',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'host_not_allowed')
  })

  test('rejects a token Home Assistant refuses', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient({ pingError: 'unauthorized' }),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'wrong-token',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unauthorized')
  })

  test('rejects a first save with no token', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: '',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'token_required')
  })

  test('succeeds and creates a new link on first save', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    const useCase = new SaveHomeAssistantConnection(
      links,
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'tok',
    })
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.token, 'tok')
    assert.isNotNull(await links.find('household-1'))
  })

  test('a blank token on an existing link keeps the stored one', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    const householdRepository = new FakeHouseholdRepository([ownerHousehold()])
    const client = new FakeHomeAssistantClient()
    const clock = FIXED_CLOCK
    const ids = SEQUENTIAL_IDS('link')

    await new SaveHomeAssistantConnection(
      links,
      client,
      new FakeHostPolicy(),
      householdRepository,
      ids,
      clock,
    ).execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'original-token',
    })

    const result = await new SaveHomeAssistantConnection(
      links,
      client,
      new FakeHostPolicy(),
      householdRepository,
      ids,
      clock,
    ).execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:9999',
      token: '',
    })
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.equal(result.value.token, 'original-token')
      assert.equal(result.value.instanceUrl.value, 'http://homeassistant.local:9999')
    }
  })
})
