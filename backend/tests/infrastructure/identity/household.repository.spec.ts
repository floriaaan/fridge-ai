import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidHouseholdRepository } from '#infrastructure/database/identity/household.repository'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'

async function createUser(id: string, email: string) {
  await db.table('user').insert({
    id,
    name: email,
    email,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

test.group('LucidHouseholdRepository', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findByUserId() round-trips a household with its owner', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    const inviteCode = InviteCode.create('AAAA1111')
    if (!inviteCode.ok) throw new Error('unreachable')

    const household = Household.create({
      id: 'h_1',
      name: 'Chez nous',
      ownerId: 'u_1',
      ownerMemberId: 'm_1',
      inviteCode: inviteCode.value,
      createdAt: new Date(),
    })

    const repository = new LucidHouseholdRepository()
    await repository.save(household)

    const found = await repository.findByUserId('u_1')
    assert.isNotNull(found)
    assert.equal(found?.name, 'Chez nous')
    assert.lengthOf(found?.members ?? [], 1)
    assert.equal(found?.members[0]?.role, 'owner')
  })

  test('save() persists a removed member as actually removed', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createUser('u_3', 'member@example.com')
    const inviteCode = InviteCode.create('BBBB2222')
    if (!inviteCode.ok) throw new Error('unreachable')

    const household = Household.create({
      id: 'h_2',
      name: 'Autre foyer',
      ownerId: 'u_2',
      ownerMemberId: 'm_2',
      inviteCode: inviteCode.value,
      createdAt: new Date(),
    })
    household.addMember('m_3', 'u_3', new Date())

    const repository = new LucidHouseholdRepository()
    await repository.save(household)

    const reloaded = await repository.findByUserId('u_2')
    reloaded?.removeMember('u_3')
    if (reloaded) await repository.save(reloaded)

    const final = await repository.findByUserId('u_2')
    assert.lengthOf(final?.members ?? [], 1)

    const goneMember = await repository.findByUserId('u_3')
    assert.isNull(goneMember)
  })

  test('findByInviteCode() finds a household by its code', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    const inviteCode = InviteCode.create('CCCC3333')
    if (!inviteCode.ok) throw new Error('unreachable')

    const household = Household.create({
      id: 'h_3',
      name: 'Foyer 3',
      ownerId: 'u_4',
      ownerMemberId: 'm_4',
      inviteCode: inviteCode.value,
      createdAt: new Date(),
    })

    const repository = new LucidHouseholdRepository()
    await repository.save(household)

    const found = await repository.findByInviteCode(inviteCode.value)
    assert.equal(found?.id, 'h_3')
  })
})
