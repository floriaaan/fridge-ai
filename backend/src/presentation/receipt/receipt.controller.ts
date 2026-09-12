import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
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
    return traceAction(ctx, 'receipt', ScanReceipt, async () => {
      const image = ctx.request.file('image', {
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
        size: '10mb',
      })
      if (!image || !image.tmpPath) {
        // The most common real cause of "extraction impossible" with nothing
        // in the AI-adapter logs: the multipart upload itself never produced
        // a usable file (wrong field name, no file attached, tmp write
        // failed) — this used to fall straight through to a generic
        // extraction_failed with no trace anywhere.
        logger.warn(
          { field: 'image', hasFile: Boolean(image), clientName: image?.clientName },
          'receipt scan: no usable file in upload',
        )
        const { status, body } = serializeError('extraction_failed')
        ctx.response.status(status).json(body)
        return { failed: true }
      }
      if (!image.isValid) {
        logger.warn(
          {
            clientName: image.clientName,
            size: image.size,
            extname: image.extname,
            errors: image.errors,
          },
          'receipt scan: uploaded file failed validation',
        )
        const { status, body } = serializeError('extraction_failed')
        ctx.response.status(status).json(body)
        return { failed: true }
      }

      const buffer = await readFile(image.tmpPath)
      const resolveExtraction = await ctx.containerResolver.make(
        'settings.resolveReceiptExtractionPort',
      )
      const extraction = await resolveExtraction()

      const result = await new ScanReceipt(extraction).execute({ image: buffer })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return { failed: true }
      }
      ctx.response.json({ draft: toReceiptDraftDto(result.value) })
      return { failed: false }
    }, { isError: (r) => r.failed })
  }

  async importReceipt(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', ImportReceipt, async () => {
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
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.status(201).json({
        receipt: toReceiptDto(result.value.receipt),
        products: result.value.products.map(toProductDto),
      })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.receipt.id : undefined) })
  }

  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', ListReceipts, async () => {
      const receipts = await ctx.containerResolver.make('receipt.receipts')
      const result = await new ListReceipts(receipts).execute({ householdId: ctx.household.id })
      ctx.response.json({ receipts: result.map(toReceiptDto) })
    })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', GetReceipt, async () => {
      const receipts = await ctx.containerResolver.make('receipt.receipts')
      const products = await ctx.containerResolver.make('fridge.products')
      const result = await new GetReceipt(receipts, products).execute({
        householdId: ctx.household.id,
        receiptId: ctx.params.id,
      })
      if (!result) {
        const { status, body } = serializeError('receipt_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }
      ctx.response.json({
        receipt: toReceiptDto(result.receipt),
        products: result.products.map(toProductDto),
      })
      return { failed: false }
    }, { isError: (r) => r.failed })
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', { name: 'GetReceiptImage' }, async () => {
      const receipts = await ctx.containerResolver.make('receipt.receipts')
      const receipt = await receipts.findById(ctx.params.id)
      if (!receipt || receipt.householdId !== ctx.household.id || !receipt.imageKey) {
        const { status, body } = serializeError('image_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }

      const storage = await ctx.containerResolver.make('shared.storage')
      const file = await storage.read(receipt.imageKey)
      if (!file) {
        const { status, body } = serializeError('image_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }

      ctx.response.header('Content-Type', file.contentType)
      ctx.response.send(file.buffer)
      return { failed: false }
    }, { isError: (r) => r.failed })
  }
}
