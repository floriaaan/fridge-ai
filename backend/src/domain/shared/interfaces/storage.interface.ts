export interface StoredFile {
  buffer: Buffer
  contentType: string
}

export interface StorageService {
  save(key: string, buffer: Buffer, contentType: string): Promise<void>
  read(key: string): Promise<StoredFile | null>
  delete(key: string): Promise<void>
}
