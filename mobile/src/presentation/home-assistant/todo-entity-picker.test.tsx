import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { TodoEntityPicker } from './todo-entity-picker.js'

const entities = [
  { entityId: 'todo.courses', friendlyName: 'Courses' },
  { entityId: 'todo.taches', friendlyName: 'Tâches ménagères' },
]

// @testing-library/react-native v14: render() AND fireEvent (press/changeText/
// scroll) are async by default, both return a Promise — every call below must
// be awaited (cf. receipt-item-row.test.tsx).
function renderPicker(onSelect = jest.fn()) {
  return render(
    <ThemeProvider>
      <TodoEntityPicker entities={entities} selectedEntityId={null} onSelect={onSelect} />
    </ThemeProvider>,
  )
}

test('lists every entity by its friendly name', async () => {
  await renderPicker()
  expect(screen.getByText('Courses')).toBeTruthy()
  expect(screen.getByText('Tâches ménagères')).toBeTruthy()
})

test('filters by search text, matching the friendly name', async () => {
  await renderPicker()
  await fireEvent.changeText(screen.getByPlaceholderText('Rechercher une liste'), 'tâches')
  expect(screen.queryByText('Courses')).toBeNull()
  expect(screen.getByText('Tâches ménagères')).toBeTruthy()
})

test('filters by search text, matching the raw entity id', async () => {
  await renderPicker()
  await fireEvent.changeText(screen.getByPlaceholderText('Rechercher une liste'), 'todo.courses')
  expect(screen.getByText('Courses')).toBeTruthy()
  expect(screen.queryByText('Tâches ménagères')).toBeNull()
})

test('tapping a row calls onSelect with that entity id', async () => {
  const onSelect = jest.fn()
  await renderPicker(onSelect)
  await fireEvent.press(screen.getByText('Courses'))
  expect(onSelect).toHaveBeenCalledWith('todo.courses', 'Courses')
})

test('marks the selected row', async () => {
  await render(
    <ThemeProvider>
      <TodoEntityPicker entities={entities} selectedEntityId="todo.courses" onSelect={jest.fn()} />
    </ThemeProvider>,
  )
  const row = screen.getByTestId('todo-entity-todo.courses')
  expect(row.props.accessibilityState?.selected).toBe(true)
})
