import type { EffectiveAiSettings } from '#domain/settings/effective-ai-settings'

export type AiSettingsDto = EffectiveAiSettings

export function toAiSettingsDto(effective: EffectiveAiSettings): AiSettingsDto {
  return effective
}
