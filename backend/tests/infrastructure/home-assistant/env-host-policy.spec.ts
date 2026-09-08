import { test } from '@japa/runner'
import env from '#start/env'
import { EnvHostPolicy } from '#infrastructure/home-assistant/env-host-policy'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'

function url(raw: string): InstanceUrl {
  const result = InstanceUrl.create(raw)
  if (!result.ok) throw new Error('bad fixture URL')
  return result.value
}

test.group('EnvHostPolicy', (group) => {
  const original = env.get('HOME_ASSISTANT_ALLOWED_HOSTS', '')
  group.each.teardown(() => process.env.HOME_ASSISTANT_ALLOWED_HOSTS = original)

  test('allows everything when the env var is unset', ({ assert }) => {
    delete process.env.HOME_ASSISTANT_ALLOWED_HOSTS
    const policy = new EnvHostPolicy()
    assert.isTrue(policy.isAllowed(url('http://192.168.1.50:8123')))
  })

  test('allows a bare hostname match', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'homeassistant.local'
    const policy = new EnvHostPolicy()
    assert.isTrue(policy.isAllowed(url('http://homeassistant.local:8123')))
  })

  test('allows a host:port match', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'homeassistant.local:8123'
    const policy = new EnvHostPolicy()
    assert.isTrue(policy.isAllowed(url('http://homeassistant.local:8123')))
  })

  test('allows case-insensitive hostname match', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'HOMEASSISTANT.LOCAL'
    const policy = new EnvHostPolicy()
    assert.isTrue(policy.isAllowed(url('http://homeassistant.local:8123')))
  })

  test('rejects a host not on the list', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'homeassistant.local'
    const policy = new EnvHostPolicy()
    assert.isFalse(policy.isAllowed(url('http://evil.example.com')))
  })

  test('rejects a right host on the wrong explicit port', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'homeassistant.local:8123'
    const policy = new EnvHostPolicy()
    assert.isFalse(policy.isAllowed(url('http://homeassistant.local:9999')))
  })
})
