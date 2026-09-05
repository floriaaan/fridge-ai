import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from './theme-provider.js'
import { ActionSheet, type ActionSheetOption } from './action-sheet.js'

function option(overrides: Partial<ActionSheetOption>): ActionSheetOption {
  return { testID: 'opt-a', label: 'A', icon: () => null, tint: '#000', onPress: jest.fn(), ...overrides }
}

test('renders nothing when not visible', async () => {
  await render(
    <ThemeProvider>
      <ActionSheet visible={false} onClose={jest.fn()} options={[option({})]} />
    </ThemeProvider>,
  )

  expect(screen.queryByTestId('opt-a')).toBeNull()
})

test('renders one pressable row per option and calls its onPress when tapped', async () => {
  const onPress = jest.fn()
  await render(
    <ThemeProvider>
      <ActionSheet visible onClose={jest.fn()} options={[option({ onPress })]} />
    </ThemeProvider>,
  )

  await fireEvent.press(screen.getByTestId('opt-a'))

  expect(onPress).toHaveBeenCalledTimes(1)
})

test('pressing the backdrop calls onClose', async () => {
  const onClose = jest.fn()
  await render(
    <ThemeProvider>
      <ActionSheet visible onClose={onClose} options={[]} />
    </ThemeProvider>,
  )

  await fireEvent.press(screen.getByTestId('action-sheet-backdrop'))

  expect(onClose).toHaveBeenCalledTimes(1)
})
