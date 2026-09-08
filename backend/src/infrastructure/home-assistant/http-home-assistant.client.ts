import type {
  HomeAssistantClient,
  HomeAssistantConnection,
} from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { TodoEntity } from '#domain/home-assistant/todo-entity'
import type { TodoItem } from '#domain/home-assistant/todo-item'
import type { HomeAssistantError } from '#domain/home-assistant/home-assistant-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

const TIMEOUT_MS = 5000
const MAX_RESPONSE_BYTES = 1_000_000

/** Cf. design §6/§7: 5s timeout, no redirects followed, a response-size cap,
 * bearer auth. Never logs the token or a request/response body. */
async function haFetch(
  connection: HomeAssistantConnection,
  path: string,
  init?: RequestInit,
): Promise<ResultType<unknown, HomeAssistantError>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${connection.instanceUrl}${path}`, {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${connection.token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })

    if (response.status === 401 || response.status === 403) return Result.err('unauthorized')
    if (!response.ok) return Result.err('unexpected_response')

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) return Result.err('unexpected_response')

    const text = await response.text()
    if (text.length > MAX_RESPONSE_BYTES) return Result.err('unexpected_response')

    // Parse JSON separately to distinguish malformed-JSON errors (unexpected_response)
    // from network errors (unreachable)
    try {
      return Result.ok(text.length > 0 ? JSON.parse(text) : null)
    } catch {
      return Result.err('unexpected_response')
    }
  } catch {
    return Result.err('unreachable')
  } finally {
    clearTimeout(timeout)
  }
}

export class HttpHomeAssistantClient implements HomeAssistantClient {
  async ping(connection: HomeAssistantConnection): Promise<ResultType<void, HomeAssistantError>> {
    const result = await haFetch(connection, '/api/')
    return result.ok ? Result.ok(undefined) : result
  }

  async listTodoEntities(
    connection: HomeAssistantConnection,
  ): Promise<ResultType<TodoEntity[], HomeAssistantError>> {
    const result = await haFetch(connection, '/api/states')
    if (!result.ok) return result
    try {
      const states = result.value as Array<{ entity_id: string; attributes?: { friendly_name?: string } }>
      const entities = states
        .filter((state) => state.entity_id.startsWith('todo.'))
        .map((state) => ({
          entityId: state.entity_id,
          friendlyName: state.attributes?.friendly_name ?? state.entity_id,
        }))
      return Result.ok(entities)
    } catch {
      return Result.err('unexpected_response')
    }
  }

  async listItems(
    connection: HomeAssistantConnection,
    entityId: string,
  ): Promise<ResultType<TodoItem[], HomeAssistantError>> {
    const result = await haFetch(connection, '/api/services/todo/get_items?return_response', {
      method: 'POST',
      body: JSON.stringify({ entity_id: entityId }),
    })
    if (!result.ok) return result
    try {
      const body = result.value as {
        service_response?: Record<
          string,
          { items?: Array<{ uid: string; summary: string; description?: string | null; status: string }> }
        >
      }
      const raw = body.service_response?.[entityId]?.items ?? []
      const items: TodoItem[] = raw.map((item) => ({
        uid: item.uid,
        summary: item.summary,
        description: item.description ?? null,
        status: item.status === 'completed' ? 'completed' : 'needs_action',
      }))
      return Result.ok(items)
    } catch {
      return Result.err('unexpected_response')
    }
  }

  async addItem(
    connection: HomeAssistantConnection,
    entityId: string,
    item: { summary: string; description: string },
  ): Promise<ResultType<void, HomeAssistantError>> {
    const result = await haFetch(connection, '/api/services/todo/add_item', {
      method: 'POST',
      body: JSON.stringify({ entity_id: entityId, item: item.summary, description: item.description }),
    })
    return result.ok ? Result.ok(undefined) : result
  }

  async updateItem(
    connection: HomeAssistantConnection,
    entityId: string,
    uid: string,
    patch: { summary?: string; description?: string; status?: 'needs_action' | 'completed' },
  ): Promise<ResultType<void, HomeAssistantError>> {
    const result = await haFetch(connection, '/api/services/todo/update_item', {
      method: 'POST',
      body: JSON.stringify({
        entity_id: entityId,
        item: uid,
        ...(patch.summary !== undefined ? { rename: patch.summary } : null),
        ...(patch.description !== undefined ? { description: patch.description } : null),
        ...(patch.status !== undefined ? { status: patch.status } : null),
      }),
    })
    return result.ok ? Result.ok(undefined) : result
  }

  async removeItem(
    connection: HomeAssistantConnection,
    entityId: string,
    uid: string,
  ): Promise<ResultType<void, HomeAssistantError>> {
    const result = await haFetch(connection, '/api/services/todo/remove_item', {
      method: 'POST',
      body: JSON.stringify({ entity_id: entityId, item: uid }),
    })
    return result.ok ? Result.ok(undefined) : result
  }
}
