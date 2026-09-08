import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { LucidHomeAssistantLinkRepository } from '#infrastructure/database/home-assistant/home-assistant-link.repository'
import { AesGcmEncryption } from '#infrastructure/shared/aes-gcm-encryption'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import db from '@adonisjs/lucid/services/db'

const KEY = Buffer.from('ci-test-encryption-key-32-bytes!')

function url(raw: string) {
  const result = InstanceUrl.create(raw)
  if (!result.ok) throw new Error('bad fixture URL')
  return result.value
}

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

async function createHousehold(id: string, ownerId: string, inviteCode: string) {
  await db.table('household').insert({
    id,
    name: 'Foyer',
    owner_id: ownerId,
    invite_code: inviteCode,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

test.group('LucidHomeAssistantLinkRepository', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('save() then find() round-trips, token decrypted transparently', async ({ assert }) => {
    const repository = new LucidHomeAssistantLinkRepository(new AesGcmEncryption(KEY))
    await createUser('user-ha-1', 'owner-ha-1@example.com')
    await createHousehold('household-ha-1', 'user-ha-1', 'ZZ999999')

    const link = HomeAssistantLink.create({
      id: 'link-ha-1',
      householdId: 'household-ha-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'super-secret-token',
      createdAt: new Date(),
    })
    await repository.save(link)

    const found = await repository.find('household-ha-1')
    assert.isNotNull(found)
    assert.equal(found?.token, 'super-secret-token')
    assert.equal(found?.instanceUrl.value, 'http://homeassistant.local:8123')
  })

  test('the stored encrypted_token column never contains the plaintext', async ({ assert }) => {
    const repository = new LucidHomeAssistantLinkRepository(new AesGcmEncryption(KEY))
    await createUser('user-ha-2', 'owner-ha-2@example.com')
    await createHousehold('household-ha-2', 'user-ha-2', 'ZZ888888')

    const link = HomeAssistantLink.create({
      id: 'link-ha-2',
      householdId: 'household-ha-2',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'super-secret-token',
      createdAt: new Date(),
    })
    await repository.save(link)

    const row = await db.from('home_assistant_link').where('id', 'link-ha-2').first()
    assert.notInclude(row.encrypted_token, 'super-secret-token')
  })

  test('find() returns null when no link exists for the household', async ({ assert }) => {
    const repository = new LucidHomeAssistantLinkRepository(new AesGcmEncryption(KEY))
    assert.isNull(await repository.find('no-such-household'))
  })
})
