import vine from '@vinejs/vine'

const recipeSourceSchema = vine.enum(['ai', 'user'] as const)
const ingredientSchema = vine.object({
  label: vine.string().trim().minLength(1),
  productId: vine.string().trim().optional().nullable(),
  quantity: vine.number().optional().nullable(),
  unit: vine.string().trim().optional().nullable(),
})

export const generateRecipesValidator = vine.compile(
  vine.object({
    prompt: vine.string().trim().maxLength(500).optional(),
  }),
)

export const saveRecipeValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(120),
    source: recipeSourceSchema,
    instructions: vine.string().trim().minLength(1),
    description: vine.string().trim().optional().nullable(),
    preparationTime: vine.number().positive().optional().nullable(),
    tags: vine.array(vine.string().trim()).optional(),
    ingredients: vine.array(ingredientSchema).minLength(1),
  }),
)
