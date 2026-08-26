import { Result } from '../../domain/shared/result.js'
import type { ApiError } from '../../domain/shared/api-error.js'

const API_URL = process.env.EXPO_PUBLIC_API_URL as string

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<Result<T, ApiError>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    const body = await response.json()
    if (!response.ok) return Result.err(body.error as ApiError)
    return Result.ok(body as T)
  } catch {
    return Result.err({ type: 'network_error', message: 'Impossible de contacter le serveur.' })
  }
}
