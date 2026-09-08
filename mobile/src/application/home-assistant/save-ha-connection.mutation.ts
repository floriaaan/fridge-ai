import { defineMutation } from '../shared/define-mutation.js'
import type { SaveHaConnectionInput } from '../../domain/home-assistant/ha-link.js'

export const useSaveHaConnectionMutation = defineMutation((connector, input: SaveHaConnectionInput) =>
  connector.saveHaConnection(input),
)
