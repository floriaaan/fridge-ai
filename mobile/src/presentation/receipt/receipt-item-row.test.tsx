import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptItemRow, type EditableReceiptItem } from './receipt-item-row.js'

const baseItem: EditableReceiptItem = {
  name: 'Lait',
  quantity: '2',
  unit: 'L',
  category: 'Produits laitiers',
  price: '2.4',
  location: 'fridge',
  expiresAt: '',
}

// @testing-library/react-native v14: render() AND fireEvent (press/changeText/
// scroll) are async by default, both return a Promise — every call below must
// be awaited (cf. login-form.test.tsx's comment; this bit the mobile test
// harness once already).
test('editing the name calls onChange with the updated item', async () => {
  const onChange = jest.fn()
  await render(
    <ThemeProvider>
      <ReceiptItemRow index={0} item={baseItem} onChange={onChange} />
    </ThemeProvider>,
  )

  await fireEvent.changeText(screen.getByTestId('receipt-item-0-name'), 'Lait entier')

  expect(onChange).toHaveBeenCalledWith({ ...baseItem, name: 'Lait entier' })
})

test('selecting a location pill calls onChange with the new location', async () => {
  const onChange = jest.fn()
  await render(
    <ThemeProvider>
      <ReceiptItemRow index={0} item={baseItem} onChange={onChange} />
    </ThemeProvider>,
  )

  await fireEvent.press(screen.getByTestId('receipt-item-0-location-freezer'))

  expect(onChange).toHaveBeenCalledWith({ ...baseItem, location: 'freezer' })
})
