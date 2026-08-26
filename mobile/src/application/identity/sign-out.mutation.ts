import { defineMutation } from '../shared/define-mutation.js'

export const useSignOutMutation = defineMutation((connector) => connector.signOut())
