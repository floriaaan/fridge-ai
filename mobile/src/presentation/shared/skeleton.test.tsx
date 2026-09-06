import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react-native'
import { ThemeProvider } from './theme-provider.js'
import { Skeleton, SkeletonList } from './skeleton.js'

async function renderIn(node: ReactNode) {
  return render(<ThemeProvider>{node}</ThemeProvider>)
}

test('a loading list announces itself once, not once per block', async () => {
  await renderIn(<SkeletonList rows={4} label="Chargement du garde-manger" />)

  expect(screen.getByLabelText('Chargement du garde-manger')).toBeTruthy()
})

test('a bare block carries no announcement of its own', async () => {
  await renderIn(<Skeleton width={40} height={12} />)

  // Every block sets `accessibilityElementsHidden`, so the group's single label
  // is the only thing a screen reader meets — never a row of rectangles.
  expect(screen.queryByLabelText('Chargement')).toBeNull()
  expect(screen.queryByRole('progressbar')).toBeNull()
})
