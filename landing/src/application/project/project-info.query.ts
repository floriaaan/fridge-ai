import { defineQuery } from '../shared/define-query.js'

export const projectInfoQuery = defineQuery(['project-info'], (connector) =>
  connector.getProjectInfo(),
)

export const useProjectInfoQuery = projectInfoQuery.use
