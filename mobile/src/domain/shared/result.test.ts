import { Result } from './result.js'

test('Result.ok() produces an ok result carrying the value', () => {
  const result = Result.ok(42)
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value).toBe(42)
})

test('Result.err() produces an err result carrying the error', () => {
  const result = Result.err('boom')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toBe('boom')
})
