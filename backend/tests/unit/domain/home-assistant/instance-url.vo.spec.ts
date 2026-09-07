import { test } from '@japa/runner'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'

test.group('InstanceUrl', () => {
  test('accepts a bare http URL and strips the trailing slash', ({ assert }) => {
    const result = InstanceUrl.create('http://homeassistant.local:8123/')
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.value, 'http://homeassistant.local:8123')
  })

  test('accepts https', ({ assert }) => {
    const result = InstanceUrl.create('https://ha.example.com')
    assert.isTrue(result.ok)
  })

  test('rejects a non-URL string', ({ assert }) => {
    assert.isFalse(InstanceUrl.create('not a url').ok)
  })

  test('rejects a non-http(s) scheme', ({ assert }) => {
    assert.isFalse(InstanceUrl.create('ftp://homeassistant.local').ok)
  })

  test('rejects embedded credentials', ({ assert }) => {
    assert.isFalse(InstanceUrl.create('http://user:pass@homeassistant.local').ok)
  })

  test('rejects a fragment', ({ assert }) => {
    assert.isFalse(InstanceUrl.create('http://homeassistant.local#foo').ok)
  })
})
