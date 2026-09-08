import { defineMutation } from '../shared/define-mutation.js'
import type { BindHaListInput } from '../../domain/home-assistant/ha-link.js'

export const useBindHaListMutation = defineMutation((connector, input: BindHaListInput) => connector.bindHaList(input))
