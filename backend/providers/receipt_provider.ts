import type { ApplicationService } from '@adonisjs/core/types'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'

export default class ReceiptProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('receipt.receipts', async () => {
      const { LucidReceiptRepository } =
        await import('#infrastructure/database/receipt/receipt.repository')
      return new LucidReceiptRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'receipt.receipts': ReceiptRepository
  }
}
