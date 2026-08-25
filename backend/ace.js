/// <reference path="./adonisrc.ts" />

import '@poppinss/ts-exec'
import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

const APP_ROOT = new URL('./', import.meta.url)

// The importer is used by AdonisJS (e.g. the "test" command loading
// @adonisjs/assembler) to import files in context of the application.
const IMPORTER = (filePath) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
  })
  .ace()
  .handle(process.argv.splice(2))
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
