import { defineMutation } from '../shared/define-mutation.js'

export const useRegenerateInviteCodeMutation = defineMutation((connector) => connector.regenerateInviteCode())
