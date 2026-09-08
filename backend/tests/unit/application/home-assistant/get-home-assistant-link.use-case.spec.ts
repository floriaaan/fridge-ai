import { test } from '@japa/runner'
import { GetHomeAssistantLink } from '#application/home-assistant/get-home-assistant-link.use-case'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { LinkUnreadableError } from '#domain/home-assistant/link-unreadable.error'
import { FakeHomeAssistantLinkRepository } from './fakes.js'

test.group('GetHomeAssistantLink', () => {
  test('returns null when no link is configured', async ({ assert }) => {
    const result = await new GetHomeAssistantLink(new FakeHomeAssistantLinkRepository()).execute({
      householdId: 'household-1',
    })
    assert.isTrue(result.ok)
    if (result.ok) assert.isNull(result.value)
  })

  test('returns the link when one exists', async ({ assert }) => {
    const repository = new FakeHomeAssistantLinkRepository()
    const urlResult = InstanceUrl.create('http://homeassistant.local:8123')
    if (!urlResult.ok) throw new Error('bad fixture')
    await repository.save(
      HomeAssistantLink.create({
        id: 'link-1',
        householdId: 'household-1',
        instanceUrl: urlResult.value,
        token: 'tok',
        createdAt: new Date(),
      }),
    )
    const result = await new GetHomeAssistantLink(repository).execute({
      householdId: 'household-1',
    })
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value?.id, 'link-1')
  })

  test('translates a LinkUnreadableError into Result.err("link_unreadable")', async ({
    assert,
  }) => {
    const repository = new FakeHomeAssistantLinkRepository()
    repository.find = async () => {
      throw new LinkUnreadableError('link-1')
    }
    const result = await new GetHomeAssistantLink(repository).execute({
      householdId: 'household-1',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'link_unreadable')
  })
})
