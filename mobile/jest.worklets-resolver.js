// react-native-worklets ships its own jest resolver (react-native-worklets/jest/resolver.js)
// that strips the `.native` extension so requires resolve to its JS-safe fallback
// (`WorkletsModule/NativeWorklets.ts`) instead of the real native module
// (`NativeWorklets.native.ts`), which otherwise throws at import time under Jest.
//
// That shipped resolver decides whether to strip native extensions by checking
// whether `options.basedir` merely *contains the substring* "react-native-worklets"
// — which pnpm's virtual store triggers by accident: any package resolved from a
// peer-dep-hashed folder like
// `expo-modules-core@57.0.14_react-native-worklets@0.10.1_.../node_modules/...`
// has that substring in its basedir even though it has nothing to do with worklets.
// That false positive broke unrelated native-view resolution (e.g.
// `expo-glass-effect`'s `GlassView.ios.tsx`, which then throws on
// `requireNativeViewManager` under Jest).
//
// This local resolver narrows the basedir check to the actual package boundary
// (a `/node_modules/react-native-worklets/` path segment, i.e. basedir is really
// inside the worklets package's own resolved folder — true for its internal
// relative requires, false for the pnpm peer-dep-hash false positive above) and
// keeps the `request`-based check for direct requires of the package itself.
module.exports = (request, options) => {
  const { defaultResolver } = options
  const basedirIsInsideWorklets = options.basedir.includes('/node_modules/react-native-worklets/')
  if (basedirIsInsideWorklets || request.includes('react-native-worklets')) {
    const workletOptions = { ...options }
    workletOptions.extensions = workletOptions.extensions?.filter((ext) => !ext.includes('native'))
    options = workletOptions
  }
  return defaultResolver(request, options)
}
