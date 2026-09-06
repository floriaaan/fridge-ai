/**
 * The lime FAB means one thing everywhere: "scan something into the foyer".
 *
 * It used to mean three different things — the dashboard opened a choice
 * sheet, Frigo pushed straight to the barcode camera, and Recettes/Courses
 * showed "bientôt disponible" on the largest, most reachable control on the
 * screen. Any tab that wires `AppShell`'s `onScan` to this hook gets the
 * same sheet and the same two destinations.
 */
import { useCallback, useState } from 'react'
import { router } from 'expo-router'
import { ActionSheet } from './action-sheet.js'
import { ReceiptIcon, ScanLineIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/** `.navigate`, not `.push`: on iOS, NativeBottomTabsRouter only special-cases
 * NAVIGATE to jump into another tab's nested stack with params. */
export function goToProductScan() {
  router.navigate({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })
}

export function goToReceiptScan() {
  router.navigate('/receipts/scan')
}

export function useScanSheet() {
  const palette = useSoftPalette()
  const [visible, setVisible] = useState(false)

  const openScanSheet = useCallback(() => setVisible(true), [])
  const closeScanSheet = useCallback(() => setVisible(false), [])

  function choose(destination: () => void) {
    closeScanSheet()
    destination()
  }

  const scanSheet = (
    <ActionSheet
      visible={visible}
      onClose={closeScanSheet}
      // Every other sheet in the app names the decision; this one shipped
      // without a `title`, so the app's largest, most-reachable control opened
      // two unframed choices.
      title="Scanner quoi ?"
      options={[
        {
          testID: 'scan-sheet-product',
          label: 'Scanner un produit',
          icon: (color) => <ScanLineIcon size={18} color={color} />,
          tint: palette.chipTeal,
          onPress: () => choose(goToProductScan),
        },
        {
          testID: 'scan-sheet-receipt',
          label: 'Scanner un ticket de caisse',
          icon: (color) => <ReceiptIcon size={18} color={color} />,
          tint: palette.chipViolet,
          onPress: () => choose(goToReceiptScan),
        },
      ]}
    />
  )

  return { openScanSheet, scanSheet }
}
