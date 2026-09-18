import { defineQuery } from '../shared/define-query.js'
import { getServerUrl } from '../shared/server-config.js'

/** `getServerUrl()` is read at query-fetch time, not here — the configured server can change (Réglages > Changer de serveur) between refetches. */
export const useInstanceInfoQuery = defineQuery(['instance-info'], (connector) =>
  connector.getInstanceInfo(getServerUrl()),
)
