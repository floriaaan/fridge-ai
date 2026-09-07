import { AggregateRoot } from '#domain/shared/aggregate-root'
import { SyncDirection } from './sync-direction.vo.js'
import type { InstanceUrl } from './instance-url.vo.js'

interface HomeAssistantLinkProps {
  householdId: string
  instanceUrl: InstanceUrl
  token: string
  todoEntityId: string | null
  todoEntityName: string | null
  direction: SyncDirection
  enabled: boolean
  lastSyncAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

/** One row per household (repository enforces uniqueness, cf. design §3 — same
 * convention as `AiProviderSettings`/`Household` not enforcing their own
 * singleton/one-per-user rule in the aggregate either). */
export class HomeAssistantLink extends AggregateRoot<string> {
  private props: HomeAssistantLinkProps

  private constructor(id: string, props: HomeAssistantLinkProps) {
    super(id)
    this.props = props
  }

  static create(params: {
    id: string
    householdId: string
    instanceUrl: InstanceUrl
    token: string
    createdAt: Date
  }): HomeAssistantLink {
    return new HomeAssistantLink(params.id, {
      householdId: params.householdId,
      instanceUrl: params.instanceUrl,
      token: params.token,
      todoEntityId: null,
      todoEntityName: null,
      direction: SyncDirection.twoWay(),
      enabled: true,
      lastSyncAt: null,
      lastError: null,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: HomeAssistantLinkProps): HomeAssistantLink {
    return new HomeAssistantLink(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get instanceUrl(): InstanceUrl {
    return this.props.instanceUrl
  }

  get token(): string {
    return this.props.token
  }

  get todoEntityId(): string | null {
    return this.props.todoEntityId
  }

  get todoEntityName(): string | null {
    return this.props.todoEntityName
  }

  get direction(): SyncDirection {
    return this.props.direction
  }

  get enabled(): boolean {
    return this.props.enabled
  }

  get lastSyncAt(): Date | null {
    return this.props.lastSyncAt
  }

  get lastError(): string | null {
    return this.props.lastError
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  updateConnection(instanceUrl: InstanceUrl, token: string, now: Date): void {
    this.props = { ...this.props, instanceUrl, token, updatedAt: now }
  }

  bindList(todoEntityId: string, todoEntityName: string, now: Date): void {
    this.props = { ...this.props, todoEntityId, todoEntityName, updatedAt: now }
  }

  changeDirection(direction: SyncDirection, now: Date): void {
    this.props = { ...this.props, direction, updatedAt: now }
  }

  setEnabled(enabled: boolean, now: Date): void {
    this.props = { ...this.props, enabled, updatedAt: now }
  }

  recordSync(now: Date): void {
    this.props = { ...this.props, lastSyncAt: now, lastError: null, updatedAt: now }
  }

  recordFailure(message: string, now: Date): void {
    this.props = { ...this.props, lastError: message.slice(0, 500), updatedAt: now }
  }
}
