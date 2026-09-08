import { defineMutation } from '../shared/define-mutation.js'

export const useUnlinkHaMutation = defineMutation((connector, _input: void) => connector.unlinkHa())
