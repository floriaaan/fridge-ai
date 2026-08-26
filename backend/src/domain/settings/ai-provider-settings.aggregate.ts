import { AggregateRoot } from '#domain/shared/aggregate-root'
import type { AiProvider } from './ai-provider.vo.js'

interface AiProviderSettingsProps {
  activeProvider: AiProvider
  updatedBy: string | null
  updatedAt: Date
}

/**
 * Singleton (one row ever, enforced by the repository's upsert, cf.
 * docs/phase-0/03-schema-base-de-donnees.md — same convention as `Household`
 * not enforcing "one household per user" in the aggregate either, cf. ADR-0003).
 * `changeProvider` returns `void`, not `Result<void>` as the domain doc's
 * sketch suggested — every `AiProvider` value is valid at this aggregate's
 * level; whether the caller is an owner (application concern) or the
 * provider has credentials configured (`AiSettingsProvider`'s concern, not
 * this aggregate's) are both checked one layer up, in
 * `SetActiveAiProvider`.
 */
export class AiProviderSettings extends AggregateRoot<string> {
  private props: AiProviderSettingsProps

  private constructor(id: string, props: AiProviderSettingsProps) {
    super(id)
    this.props = props
  }

  static seedFromEnv(id: string, defaultProvider: AiProvider, now: Date): AiProviderSettings {
    return new AiProviderSettings(id, { activeProvider: defaultProvider, updatedBy: null, updatedAt: now })
  }

  static reconstruct(id: string, props: AiProviderSettingsProps): AiProviderSettings {
    return new AiProviderSettings(id, props)
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
    this.props = { activeProvider: provider, updatedBy: changedBy, updatedAt: now }
  }
}
