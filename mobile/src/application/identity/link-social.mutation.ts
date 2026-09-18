import { defineMutation } from '../shared/define-mutation.js'

export const useLinkSocialMutation = defineMutation((connector, provider: 'pocketid' | 'google') =>
  connector.linkSocial(provider),
)
