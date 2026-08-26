import { configApp, INCLUDE_LIST } from '@adonisjs/eslint-config'

export default configApp({
  name: 'Project overrides',
  files: INCLUDE_LIST,
  rules: {
    // This codebase's naming convention is dotted kebab-case
    // (`create-product.use-case.ts`, `product-repository.interface.ts`,
    // `household.aggregate.ts`) throughout src/domain, src/application,
    // src/infrastructure, src/presentation — not the config's default
    // snake_case.
    '@unicorn/filename-case': 'off',
  },
})
