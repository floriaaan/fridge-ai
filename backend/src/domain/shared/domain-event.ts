export interface DomainEvent<Payload = unknown> {
  readonly name: string
  readonly occurredAt: Date
  readonly payload: Payload
}
