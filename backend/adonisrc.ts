import { indexEntities } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  experimental: {},

  commands: [() => import('@adonisjs/core/commands'), () => import('@adonisjs/lucid/commands')],

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/shield/shield_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('#providers/shared_provider'),
    () => import('#providers/identity_provider'),
    () => import('#providers/settings_provider'),
    () => import('#providers/fridge_provider'),
    () => import('#providers/receipt_provider'),
    () => import('#providers/shopping_list_provider'),
    () => import('#providers/recipe_provider'),
  ],

  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
    () => import('#start/validator'),
  ],

  tests: {
    suites: [
      {
        files: [
          'tests/unit/**/*.spec.{ts,js}',
          'tests/domain/**/*.spec.{ts,js}',
          'tests/application/**/*.spec.{ts,js}',
          'tests/infrastructure/**/*.spec.{ts,js}',
        ],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec.{ts,js}'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: false,
  },

  metaFiles: [],

  hooks: {
    init: [
      // @ts-expect-error — @adonisjs/core's `indexEntities()` hook type
      // doesn't cover the `CodeGen` build phase in this installed version
      // (upstream typing gap between @adonisjs/core and @adonisjs/assembler,
      // not an application bug); the hook itself runs correctly at runtime.
      indexEntities({
        transformers: { enabled: true },
      }),
    ],
  },
})
