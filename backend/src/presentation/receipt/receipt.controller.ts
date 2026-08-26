import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { importReceiptValidator } from './receipt.validator.js'
import { toReceiptDraftDto, toReceiptDto } from './receipt.dto.js'
import { toProductDto } from '#presentation/fridge/product.dto'
import { ScanReceipt } from '#application/receipt/scan-receipt.use-case'
import { ImportReceipt } from '#application/receipt/import-receipt.use-case'
import { GetReceipt } from '#application/receipt/get-receipt.use-case'
import { ListReceipts } from '#application/receipt/list-receipts.use-case'

export default class ReceiptController {
  async scan(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const image = ctx.request.file('image', {
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
      size: '10mb',
    })
    if (!image || !image.tmpPath) {
      const { status, body } = serializeError('extraction_failed')
      return ctx.response.status(status).json(body)
    }
    if (!image.isValid) {
      const { status, body } = serializeError('extraction_failed')
      return ctx.response.status(status).json(body)
    }

    const buffer = await readFile(image.tmpPath)
    const resolveExtraction = await ctx.containerResolver.make(
      'settings.resolveReceiptExtractionPort',
    )
    const extraction = await resolveExtraction()

    const result = await new ScanReceipt(extraction).execute({ image: buffer })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ draft: toReceiptDraftDto(result.value) })
  }

  async importReceipt(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(importReceiptValidator)
    const receipts = await ctx.containerResolver.make('receipt.receipts')
    const products = await ctx.containerResolver.make('fridge.products')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
    const clock = await ctx.containerResolver.make('shared.clock')

    const result = await new ImportReceipt(receipts, products, idGenerator, clock).execute({
      householdId: ctx.household.id,
      storeName: payload.storeName,
      scannedAt: payload.scannedAt,
      totalAmount: payload.totalAmount,
      // imageKey is always server-generated (no phase-2 write path exists yet); never
      // sourced from client input to avoid unsanitized data reaching filesystem paths.
      imageKey: null,
      items: payload.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category ?? null,
        price: item.price ?? null,
        location: item.location,
        expiresAt: item.expiresAt ?? null,
      })),
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }

    return ctx.response.status(201).json({
      receipt: toReceiptDto(result.value.receipt),
      products: result.value.products.map(toProductDto),
    })
  }

  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const receipts = await ctx.containerResolver.make('receipt.receipts')
    const result = await new ListReceipts(receipts).execute({ householdId: ctx.household.id })
    return ctx.response.json({ receipts: result.map(toReceiptDto) })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const receipts = await ctx.containerResolver.make('receipt.receipts')
    const products = await ctx.containerResolver.make('fridge.products')
    const result = await new GetReceipt(receipts, products).execute({
      householdId: ctx.household.id,
      receiptId: ctx.params.id,
    })
    if (!result) {
      const { status, body } = serializeError('receipt_not_found')
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({
      receipt: toReceiptDto(result.receipt),
      products: result.products.map(toProductDto),
    })
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const receipts = await ctx.containerResolver.make('receipt.receipts')
    const receipt = await receipts.findById(ctx.params.id)
    if (!receipt || receipt.householdId !== ctx.household.id || !receipt.imageKey) {
      const { status, body } = serializeError('image_not_found')
      return ctx.response.status(status).json(body)
    }

    const storage = await ctx.containerResolver.make('shared.storage')
    const file = await storage.read(receipt.imageKey)
    if (!file) {
      const { status, body } = serializeError('image_not_found')
      return ctx.response.status(status).json(body)
    }

    ctx.response.header('Content-Type', file.contentType)
    return ctx.response.send(file.buffer)
  }
}
