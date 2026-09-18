import { test } from '@japa/runner'
import { HandleRevenueCatWebhook } from '#application/settings/handle-revenuecat-webhook.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type {
  HouseholdSubscription,
  SubscriptionPort,
} from '#domain/settings/interfaces/subscription-port.interface'

function fakeHousehold(id: string): Household {
  const invite = InviteCode.create('ABCD1234')
  if (!invite.ok) throw new Error('bad fixture invite code')
  return Household.create({
    id,
    name: 'Foyer test',
    ownerId: 'u_owner',
    ownerMemberId: 'm_owner',
    inviteCode: invite.value,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })
}

class FakeHouseholdRepository implements HouseholdRepository {
  constructor(private readonly households: Household[]) {}
  async findById(id: string) {
    return this.households.find((h) => h.id === id) ?? null
  }
  async findByUserId() {
    return null
  }
  async findByInviteCode() {
    return null
  }
  async save() {}
  async delete() {}
}

class FakeSubscriptionPort implements SubscriptionPort {
  upserts: Array<{ householdId: string; payerUserId: string | null; store: string; expiresAt: Date }> = []
  async hasActiveSubscription() {
    return false
  }
  async find(): Promise<HouseholdSubscription | null> {
    return null
  }
  async revokeForPayer() {}
  async upsert(params: {
    householdId: string
    payerUserId: string | null
    store: 'app_store' | 'play_store'
    expiresAt: Date
  }) {
    this.upserts.push(params)
  }
}

test.group('HandleRevenueCatWebhook', () => {
  test('upserts the entitlement on RENEWAL, with the payer attribute', async ({ assert }) => {
    const households = new FakeHouseholdRepository([fakeHousehold('h_1')])
    const subscriptions = new FakeSubscriptionPort()

    await new HandleRevenueCatWebhook(subscriptions, households).execute({
      type: 'RENEWAL',
      app_user_id: 'h_1',
      expiration_at_ms: Date.parse('2026-10-18T00:00:00Z'),
      store: 'APP_STORE',
      subscriber_attributes: { user_id: { value: 'u_payer' } },
    })

    assert.lengthOf(subscriptions.upserts, 1)
    assert.deepEqual(subscriptions.upserts[0], {
      householdId: 'h_1',
      payerUserId: 'u_payer',
      store: 'app_store',
      expiresAt: new Date('2026-10-18T00:00:00Z'),
    })
  })

  test('maps PLAY_STORE to play_store', async ({ assert }) => {
    const households = new FakeHouseholdRepository([fakeHousehold('h_1')])
    const subscriptions = new FakeSubscriptionPort()

    await new HandleRevenueCatWebhook(subscriptions, households).execute({
      type: 'INITIAL_PURCHASE',
      app_user_id: 'h_1',
      expiration_at_ms: Date.parse('2026-10-18T00:00:00Z'),
      store: 'PLAY_STORE',
    })

    assert.equal(subscriptions.upserts[0]!.store, 'play_store')
  })

  test('cuts entitlement short on EXPIRATION', async ({ assert }) => {
    const households = new FakeHouseholdRepository([fakeHousehold('h_1')])
    const subscriptions = new FakeSubscriptionPort()

    await new HandleRevenueCatWebhook(subscriptions, households).execute({
      type: 'EXPIRATION',
      app_user_id: 'h_1',
      expiration_at_ms: Date.parse('2026-09-18T10:00:00Z'),
      store: 'APP_STORE',
    })

    assert.equal(subscriptions.upserts[0]!.expiresAt.toISOString(), '2026-09-18T10:00:00.000Z')
  })

  test('ignores an unknown household without throwing', async ({ assert }) => {
    const households = new FakeHouseholdRepository([])
    const subscriptions = new FakeSubscriptionPort()

    await new HandleRevenueCatWebhook(subscriptions, households).execute({
      type: 'RENEWAL',
      app_user_id: 'h_deleted',
      expiration_at_ms: Date.parse('2026-10-18T00:00:00Z'),
      store: 'APP_STORE',
    })

    assert.lengthOf(subscriptions.upserts, 0)
  })

  test('ignores an event type this instance does not act on', async ({ assert }) => {
    const households = new FakeHouseholdRepository([fakeHousehold('h_1')])
    const subscriptions = new FakeSubscriptionPort()

    await new HandleRevenueCatWebhook(subscriptions, households).execute({
      type: 'TRANSFER',
      app_user_id: 'h_1',
      expiration_at_ms: Date.parse('2026-10-18T00:00:00Z'),
      store: 'APP_STORE',
    })

    assert.lengthOf(subscriptions.upserts, 0)
  })

  test('ignores TEST events', async ({ assert }) => {
    const households = new FakeHouseholdRepository([fakeHousehold('h_1')])
    const subscriptions = new FakeSubscriptionPort()

    await new HandleRevenueCatWebhook(subscriptions, households).execute({
      type: 'TEST',
      app_user_id: 'h_1',
      expiration_at_ms: null,
      store: 'APP_STORE',
    })

    assert.lengthOf(subscriptions.upserts, 0)
  })
})
