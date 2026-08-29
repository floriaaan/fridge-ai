import { useRef } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

type BarcodeScannerMode = ({ mode: 'create' } | { mode: 'edit'; productId: string }) & {
  // True when the scanner was pushed from a form that's already open (the form's own
  // "Scanner un code-barres" button) — as opposed to a fresh scan from the dashboard/sidebar
  // where no form exists yet. Determines how a scanned barcode is delivered back: dismiss
  // onto the existing form instance vs. open a brand-new one.
  fromForm?: boolean
}

export function BarcodeScannerScreen(props: BarcodeScannerMode) {
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  // A ref, not state: `onBarcodeScanned` can fire multiple times before a state update
  // commits a re-render, so several calls could all observe `handled === false` and all
  // navigate. A ref is read/written synchronously, so only the first call ever proceeds.
  const handledRef = useRef(false)

  function handleBarcodeScanned({ data }: { data: string }) {
    if (handledRef.current) return
    handledRef.current = true

    if (props.fromForm) {
      // A form is already open underneath the scanner in the stack — dismiss back onto it
      // and update its `prefillBarcode` param, rather than opening a new form instance
      // (which would discard whatever the user had already typed there).
      router.back()
      router.setParams({ prefillBarcode: data })
      return
    }

    if (props.mode === 'edit') {
      router.replace({ pathname: '/(tabs)/fridge/[id]/edit', params: { id: props.productId, prefillBarcode: data } })
      return
    }
    router.replace({ pathname: '/(tabs)/fridge/new', params: { prefillBarcode: data } })
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$3" alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.ink} textAlign="center">
            L&apos;accès à la caméra est nécessaire pour scanner un code-barres.
          </Text>
          <Pressable
            testID="barcode-scanner-request-permission"
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Autoriser la caméra"
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" paddingHorizontal="$4">
              <Text fontWeight="800" color={palette.accentLimeText}>
                Autoriser la caméra
              </Text>
            </YStack>
          </Pressable>
        </YStack>
      </SafeAreaView>
    )
  }

  return (
    <YStack flex={1}>
      <CameraView
        testID="fridge-barcode-camera"
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Pressable
          testID="barcode-scanner-close"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Fermer le scanner"
          style={[pointerCursor, { padding: 16 }]}
        >
          <Text fontSize={24} color="#FFFFFF">
            ×
          </Text>
        </Pressable>
      </SafeAreaView>
    </YStack>
  )
}
