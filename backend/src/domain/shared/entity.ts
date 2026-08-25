export abstract class Entity<Id> {
  readonly id: Id

  protected constructor(id: Id) {
    this.id = id
  }

  equals(other: unknown): boolean {
    if (other === this) return true
    if (!(other instanceof Entity)) return false
    if (other.constructor !== this.constructor) return false
    return other.id === this.id
  }
}
