export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export type Result<T, E> = Ok<T> | Err<E>

export const Result = {
  ok<T>(value: T): Ok<T> {
    return { ok: true, value }
  },
  err<E>(error: E): Err<E> {
    return { ok: false, error }
  },
}
