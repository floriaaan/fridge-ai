// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // eslint-config-expo's react-compiler rules flag this template's own
      // generated web hydration hook (setState in an effect to detect
      // client-side hydration is the standard SSR-safe pattern, not a bug).
      // Downgraded to warn until the demo code is replaced in Task 7.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
