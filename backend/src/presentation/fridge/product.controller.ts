import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import {
  createProductValidator,
  updateProductValidator,
  listProductsValidator,
  expiringSoonValidator,
  lookupProductValidator,
} from './product.validator.js'
import { toProductDto } from './product.dto.js'
import { CreateProduct } from '#application/fridge/create-product.use-case'
import { UpdateProduct } from '#application/fridge/update-product.use-case'
import { DeleteProduct } from '#application/fridge/delete-product.use-case'
import { GetProduct } from '#application/fridge/get-product.use-case'
import { ListProducts } from '#application/fridge/list-products.use-case'
import { GetExpiringSoonProducts } from '#application/fridge/get-expiring-soon-products.use-case'
import { LookupProduct } from '#application/fridge/lookup-product.use-case'

export default class ProductController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const { location, expiringWithinDays } = await ctx.request.validateUsing(listProductsValidator)
    const products = await ctx.containerResolver.make('fridge.products')

    const result = await new ListProducts(products).execute({
      householdId: ctx.household.id,
      location,
      expiringWithinDays,
    })
    return ctx.response.json({ products: result.map(toProductDto) })
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(createProductValidator)
    const products = await ctx.containerResolver.make('fridge.products')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
    const clock = await ctx.containerResolver.make('shared.clock')

    const result = await new CreateProduct(products, idGenerator, clock).execute({
      householdId: ctx.household.id,
      ...payload,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ product: toProductDto(result.value) })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const products = await ctx.containerResolver.make('fridge.products')
    const product = await new GetProduct(products).execute({
      householdId: ctx.household.id,
      productId: ctx.params.id,
    })
    if (!product) {
      const { status, body } = serializeError('product_not_found')
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ product: toProductDto(product) })
  }

  async update(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(updateProductValidator)
    const products = await ctx.containerResolver.make('fridge.products')
    const clock = await ctx.containerResolver.make('shared.clock')

    const result = await new UpdateProduct(products, clock).execute({
      householdId: ctx.household.id,
      productId: ctx.params.id,
      ...payload,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ product: toProductDto(result.value) })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const products = await ctx.containerResolver.make('fridge.products')
    const result = await new DeleteProduct(products).execute({
      householdId: ctx.household.id,
      productId: ctx.params.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(204).send('')
  }

  async expiringSoon(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const { days } = await ctx.request.validateUsing(expiringSoonValidator)
    const products = await ctx.containerResolver.make('fridge.products')
    const result = await new GetExpiringSoonProducts(products).execute({
      householdId: ctx.household.id,
      days: days ?? 3,
    })
    return ctx.response.json({ products: result.map(toProductDto) })
  }

  async lookup(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const { barcode } = await ctx.request.validateUsing(lookupProductValidator)
    const lookupPort = await ctx.containerResolver.make('fridge.productLookup')
    const result = await new LookupProduct(lookupPort).execute({ barcode })
    return ctx.response.json({ result })
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const products = await ctx.containerResolver.make('fridge.products')
    const product = await new GetProduct(products).execute({
      householdId: ctx.household.id,
      productId: ctx.params.id,
    })
    if (!product || !product.imageKey) {
      const { status, body } = serializeError('image_not_found')
      return ctx.response.status(status).json(body)
    }

    const storage = await ctx.containerResolver.make('shared.storage')
    const file = await storage.read(product.imageKey)
    if (!file) {
      const { status, body } = serializeError('image_not_found')
      return ctx.response.status(status).json(body)
    }

    ctx.response.header('Content-Type', file.contentType)
    return ctx.response.send(file.buffer)
  }
}
