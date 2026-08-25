import type { Clock } from '#domain/shared/clock.interface'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
