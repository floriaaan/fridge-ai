import { AggregateRoot } from '#domain/shared/aggregate-root'
import type { AiProvider } from './ai-provider.vo.js'

interface AiProviderSettingsProps {
  householdId: string
  activeProvider: AiProvider
  updatedBy: string | null
  updatedAt: Date
}

/**
 * One row per household (was a singleton until 2026-09-18, cf.
 * docs/adr/0007) — uniqueness on `household_id` is a DB constraint, the
 * repository's `find(householdId)` reads it.
 * `changeProvider` returns `void`, not `Result<void>` as the domain doc's
 * sketch suggested — every `AiProvider` value is valid at this aggregate's
 * level; whether the caller is an owner (application concern), whether the
 * provider has credentials, and whether it is paywalled
 * (`AiSettingsProvider`'s concern, not this aggregate's) are all checked one
 * layer up, in `SetActiveAiProvider`.
 */
export class AiProviderSettings extends AggregateRoot<string> {
  private props: AiProviderSettingsProps

  private constructor(id: string, props: AiProviderSettingsProps) {
    super(id)
    this.props = props
  }

  static seedFromEnv(
    id: string,
    householdId: string,
    defaultProvider: AiProvider,
    now: Date,
  ): AiProviderSettings {
    return new AiProviderSettings(id, {
      householdId,
      activeProvider: defaultProvider,
      updatedBy: null,
      updatedAt: now,
    })
  }

  static reconstruct(id: string, props: AiProviderSettingsProps): AiProviderSettings {
    return new AiProviderSettings(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get activeProvider(): AiProvider {
    return this.props.activeProvider
  }

  get updatedBy(): string | null {
    return this.props.updatedBy
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  changeProvider(provider: AiProvider, changedBy: string, now: Date): void {
    this.props = { ...this.props, activeProvider: provider, updatedBy: changedBy, updatedAt: now }
  }
}
