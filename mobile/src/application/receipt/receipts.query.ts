import { defineQuery } from '../shared/define-query.js'

export const useReceiptsQuery = defineQuery(['receipts'], (connector) => connector.getReceipts())
