/**
 * Concrete value objects keep their constructor private and expose a static
 * `create(...)` factory returning either the VO directly (when creation
 * cannot fail) or a `Result<TheVO, ValidationError>` (when it can) — this
 * base class only provides structural equality and immutability.
 */
export abstract class ValueObject<Props> {
  protected readonly props: Props

  protected constructor(props: Props) {
    this.props = Object.freeze(props)
  }

  equals(other: unknown): boolean {
    if (other === this) return true
    if (!(other instanceof ValueObject)) return false
    if (other.constructor !== this.constructor) return false
    return JSON.stringify(other.props) === JSON.stringify(this.props)
  }
}
