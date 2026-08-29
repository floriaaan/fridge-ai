import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from './theme-provider.js'
import { ActionSheet } from './action-sheet.js'

test('renders nothing when not visible', async () => {
  await render(
    <ThemeProvider>
      <ActionSheet visible={false} onClose={jest.fn()} options={[{ testID: 'opt-a', label: 'A', onPress: jest.fn() }]} />
    </ThemeProvider>,
  )

  expect(screen.queryByTestId('opt-a')).toBeNull()
})

test('renders one pressable row per option and calls its onPress when tapped', async () => {
  const onPress = jest.fn()
  await render(
    <ThemeProvider>
      <ActionSheet visible onClose={jest.fn()} options={[{ testID: 'opt-a', label: 'A', onPress }]} />
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
