import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { StorageService, StoredFile } from '#domain/shared/interfaces/storage.interface'

/**
 * Content type isn't derivable from `key` alone (callers choose opaque keys,
 * cf. docs/phase-0/02-modele-de-domaine.md's "clé de stockage opaque, jamais
 * une URL publique") — stored in a `<key>.meta.json` sidecar next to the
 * file rather than pulling in a mime-sniffing dependency.
 */
export class LocalFilesystemStorage implements StorageService {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    return join(this.root, key)
  }

  async save(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const filePath = this.resolve(key)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, buffer)
    await writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType }))
  }

  async read(key: string): Promise<StoredFile | null> {
    const filePath = this.resolve(key)
    try {
      const buffer = await readFile(filePath)
      const meta = JSON.parse(await readFile(`${filePath}.meta.json`, 'utf-8')) as {
        contentType: string
      }
      return { buffer, contentType: meta.contentType }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolve(key)
    await rm(filePath, { force: true })
    await rm(`${filePath}.meta.json`, { force: true })
  }
}
