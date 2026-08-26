import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalFilesystemStorage } from '#infrastructure/storage/local-filesystem-storage'

test.group('LocalFilesystemStorage', (group) => {
  const root = join(tmpdir(), `fridge-ai-storage-test-${randomUUID()}`)
  group.teardown(() => rm(root, { recursive: true, force: true }))

  test('save() then read() round-trips the buffer and content type', async ({ assert }) => {
    const storage = new LocalFilesystemStorage(root)
    await storage.save('receipts/a.jpg', Buffer.from('hello'), 'image/jpeg')

    const file = await storage.read('receipts/a.jpg')
    assert.isNotNull(file)
    assert.equal(file?.buffer.toString(), 'hello')
    assert.equal(file?.contentType, 'image/jpeg')
  })

  test('read() returns null for a missing key', async ({ assert }) => {
    const storage = new LocalFilesystemStorage(root)
    const file = await storage.read('receipts/missing.jpg')
    assert.isNull(file)
  })

  test('delete() removes the file — a later read() returns null', async ({ assert }) => {
    const storage = new LocalFilesystemStorage(root)
    await storage.save('receipts/b.jpg', Buffer.from('bye'), 'image/jpeg')
    await storage.delete('receipts/b.jpg')
    const file = await storage.read('receipts/b.jpg')
    assert.isNull(file)
  })
})
