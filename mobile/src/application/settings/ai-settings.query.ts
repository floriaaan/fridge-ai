import { defineQuery } from '../shared/define-query.js'

export const useAiSettingsQuery = defineQuery(['ai-settings'], (connector) => connector.getAiSettings())
