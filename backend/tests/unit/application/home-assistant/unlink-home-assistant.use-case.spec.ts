import { test } from '@japa/runner'
import { UnlinkHomeAssistant } from '#application/home-assistant/unlink-home-assistant.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import { FakeHomeAssistantLinkRepository, FakeHouseholdRepository, FakeShoppingItemRepository } from './fakes.js'

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

test.group('UnlinkHomeAssistant', () => {
  test('rejects a non-owner', async ({ assert }) => {
    const useCase = new UnlinkHomeAssistant(
      new FakeHomeAssistantLinkRepository(),
      new FakeShoppingItemRepository(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'not-owner', householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_owner')
  })

  test('fails with link_not_found when there is nothing to unlink', async ({ assert }) => {
    const useCase = new UnlinkHomeAssistant(
      new FakeHomeAssistantLinkRepository(),
      new FakeShoppingItemRepository(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'link_not_found')
  })

  test('deletes the link and clears every item’s sync bookmark', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    const urlResult = InstanceUrl.create('http://homeassistant.local:8123')
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!urlResult.ok || !quantity.ok || !source.ok) throw new Error('bad fixtures')
    await links.save(
      HomeAssistantLink.create({
        id: 'link-1',
        householdId: 'household-1',
        instanceUrl: urlResult.value,
        token: 'tok',
        createdAt: new Date(),
      }),
    )
    const items = new FakeShoppingItemRepository()
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date(),
    })
    item.markSynced('ha-uid-1', new Date())
    await items.save(item)

    const useCase = new UnlinkHomeAssistant(links, items, new FakeHouseholdRepository([ownerHousehold()]))
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1' })
    assert.isTrue(result.ok)
    assert.isNull(await links.find('household-1'))
    assert.isNull((await items.findById('item-1'))?.haUid)
  })
})
