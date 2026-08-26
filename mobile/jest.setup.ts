// @testing-library/react-native v12.4+ (we're on v14) auto-extends Jest's `expect`
// with its matchers (toBeTruthy, toHaveTextContent, etc.) — the `extend-expect`
// subpath the brief specified no longer exists in this version and would fail to
// resolve. No import is needed here; this file is kept as the `setupFiles` entry
// point for any future global test setup.
export {}
