import { Entity } from './entity.js'
import type { DomainEvent } from './domain-event.js'

export abstract class AggregateRoot<Id> extends Entity<Id> {
  private events: DomainEvent[] = []

  protected record(event: DomainEvent): void {
    this.events.push(event)
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.events
    this.events = []
    return events
  }
}
