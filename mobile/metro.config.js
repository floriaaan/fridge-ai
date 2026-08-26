const { getDefaultConfig } = require('expo/metro-config')
const { withTamagui } = require('@tamagui/metro-plugin')

const config = getDefaultConfig(__dirname)

// The codebase's relative imports use the TS/ESM-style explicit `.js`
// extension (e.g. `from '../../application/identity/session.query.js'`)
// even though the source files are `.ts`/`.tsx` — this is what
// `"moduleResolution": "bundler"` expects, and it's what jest's own
// `moduleNameMapper: { "^(.+)\\.js$": "$1" }` already strips for tests.
// Metro has no equivalent built in: given an explicit `.js` specifier it
// looks only for a literal `.js` file and fails when just the `.ts`/`.tsx`
// source exists. Mirror the jest behavior here — on a failed `.js`
// resolution for a relative/absolute specifier, retry without the
// extension so Metro's normal source-extension resolution (`.tsx`, `.ts`,
// `.js`, …) finds the real file.
const { resolver: { resolveRequest: defaultResolveRequest } = {} } = config
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^[./]/.test(moduleName) && moduleName.endsWith('.js')) {
    try {
      return (defaultResolveRequest ?? context.resolveRequest)(
        context,
        moduleName.slice(0, -3),
        platform,
      )
    } catch {
      // fall through to the default behavior below
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: './tamagui.config.ts',
})
