// @testing-library/react-native v12.4+ (we're on v14) auto-extends Jest's `expect`
// with its matchers (toBeTruthy, toHaveTextContent, etc.) — the `extend-expect`
// subpath the brief specified no longer exists in this version and would fail to
// resolve. No import is needed here; this file is kept as the `setupFiles` entry
// point for any future global test setup.

// Tamagui components (YStack, Text, Button, Input…) call `getConfig()` at
// render time and throw "Missing tamagui config" unless `createTamagui()` has
// run first as a side effect. The app wires this by importing tamagui.config
// via ThemeProvider (src/app/_layout.tsx), but component tests (e.g.
// login-form.test.tsx) render a form directly without mounting ThemeProvider
// — so the config must be registered globally here instead.
import './tamagui.config'

export {}
