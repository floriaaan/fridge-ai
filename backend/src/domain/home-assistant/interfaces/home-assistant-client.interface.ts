import type { Result } from '#domain/shared/result'
import type { TodoEntity } from '../todo-entity.js'
import type { TodoItem } from '../todo-item.js'
import type { HomeAssistantError } from '../home-assistant-error.js'

export interface HomeAssistantConnection {
  instanceUrl: string
  token: string
}

export interface HomeAssistantClient {
  ping(connection: HomeAssistantConnection): Promise<Result<void, HomeAssistantError>>
  listTodoEntities(
    connection: HomeAssistantConnection,
  ): Promise<Result<TodoEntity[], HomeAssistantError>>
  listItems(
    connection: HomeAssistantConnection,
    entityId: string,
  ): Promise<Result<TodoItem[], HomeAssistantError>>
  addItem(
    connection: HomeAssistantConnection,
    entityId: string,
    item: { summary: string; description: string },
  ): Promise<Result<void, HomeAssistantError>>
  updateItem(
    connection: HomeAssistantConnection,
    entityId: string,
    uid: string,
    patch: { summary?: string; description?: string; status?: 'needs_action' | 'completed' },
  ): Promise<Result<void, HomeAssistantError>>
  removeItem(
    connection: HomeAssistantConnection,
    entityId: string,
    uid: string,
  ): Promise<Result<void, HomeAssistantError>>
}
