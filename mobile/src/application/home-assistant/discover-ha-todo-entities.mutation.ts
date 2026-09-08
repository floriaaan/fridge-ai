import { defineMutation } from '../shared/define-mutation.js'
import type { DiscoverHaEntitiesInput } from '../../domain/home-assistant/ha-link.js'

export const useDiscoverHaTodoEntitiesMutation = defineMutation((connector, input: DiscoverHaEntitiesInput) =>
  connector.discoverHaTodoEntities(input),
)
