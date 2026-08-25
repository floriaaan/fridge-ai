import { v7 as uuidv7 } from 'uuid'
import type { IdGenerator } from '#domain/shared/id-generator.interface'

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return uuidv7()
  }
}
