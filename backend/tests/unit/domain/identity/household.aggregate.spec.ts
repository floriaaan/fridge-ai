import { test } from '@japa/runner'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'

function buildHousehold() {
  const inviteCodeResult = InviteCode.create('AAAA1111')
  if (!inviteCodeResult.ok) throw new Error('unreachable')

  return Household.create({
    id: 'h_1',
    name: 'Chez nous',
    ownerId: 'u_owner',
    ownerMemberId: 'm_owner',
    inviteCode: inviteCodeResult.value,
    createdAt: new Date('2026-08-25T10:00:00Z'),
  })
}

test.group('Household', () => {
  test('create() seeds the owner as its first member', ({ assert }) => {
    const household = buildHousehold()
    assert.lengthOf(household.members, 1)
    assert.equal(household.members[0]?.userId, 'u_owner')
    assert.equal(household.members[0]?.role, 'owner')
  })

  test('addMember() adds a new member with role "member"', ({ assert }) => {
    const household = buildHousehold()
    const result = household.addMember('m_bob', 'u_bob', new Date('2026-08-25T11:00:00Z'))
    assert.isTrue(result.ok)
    assert.lengthOf(household.members, 2)
    assert.equal(household.members[1]?.role, 'member')
  })

  test('addMember() rejects a userId already a member', ({ assert }) => {
    const household = buildHousehold()
    const result = household.addMember('m_owner_dup', 'u_owner', new Date())
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'already_member')
  })

  test('removeMember() rejects removing the owner', ({ assert }) => {
    const household = buildHousehold()
    const result = household.removeMember('u_owner')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'cannot_remove_owner')
  })

  test('removeMember() removes a non-owner member', ({ assert }) => {
    const household = buildHousehold()
    household.addMember('m_bob', 'u_bob', new Date())
    const result = household.removeMember('u_bob')
    assert.isTrue(result.ok)
    assert.lengthOf(household.members, 1)
  })

  test('removeMember() rejects a userId that is not a member', ({ assert }) => {
    const household = buildHousehold()
    const result = household.removeMember('u_unknown')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_a_member')
  })

  test('regenerateInviteCode() replaces the invite code', ({ assert }) => {
    const household = buildHousehold()
    const newCodeResult = InviteCode.create('BBBB2222')
    if (!newCodeResult.ok) throw new Error('unreachable')
    household.regenerateInviteCode(newCodeResult.value)
    assert.equal(household.inviteCode.value, 'BBBB2222')
  })
})
