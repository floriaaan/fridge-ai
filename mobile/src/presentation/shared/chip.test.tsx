import { render } from '@testing-library/react-native'
import { ThemeProvider } from './theme-provider.js'
import { Chip } from './chip.js'
import { lightPaletteForTests } from '../dashboard/soft-palette.js'

const noop = () => {}

/**
 * The chip was shrunk from 44pt tall to 32 because a row of them read as a
 * stack of buttons inside a form. 44 was the touch-target floor, not a look —
 * so this pins that the floor survived the shrink as `hitSlop` instead of as
 * height. Without it the next "make it smaller" pass silently takes the target
 * with it.
 */
test('a chip smaller than 44pt pads its press area back past the touch-target floor', async () => {
  const view = await render(
    <ThemeProvider>
      <Chip testID="c" label="Frigo" selected={false} onPress={noop} palette={lightPaletteForTests} />
    </ThemeProvider>,
  )

  const slop = view.getByTestId('c').props.hitSlop
  expect(32 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44)
})

test('a dense chip does too', async () => {
  const view = await render(
    <ThemeProvider>
      <Chip testID="d" label="kg" selected onPress={noop} palette={lightPaletteForTests} size="dense" />
    </ThemeProvider>,
  )

  const slop = view.getByTestId('d').props.hitSlop
  expect(28 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44)
})
