import { useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { CameraPermissionModal } from '../shared/camera-permission-modal.js'
import { goBack } from '../shared/navigation.js'
import { XIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export function ReceiptScannerScreen() {
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [capturing, setCapturing] = useState(false)

  function goToReview(imageUri: string) {
    router.replace({ pathname: '/(tabs)/receipts/review', params: { imageUri } })
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 })
      if (photo?.uri) goToReview(photo.uri)
    } finally {
      setCapturing(false)
    }
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) goToReview(result.assets[0].uri)
  }

  if (!permission?.granted) {
    return (
      <CameraPermissionModal
        palette={palette}
        message="L'accès à la caméra est nécessaire pour scanner un ticket de caisse."
        canAskAgain={permission?.canAskAgain ?? true}
        onRequestPermission={requestPermission}
        onClose={() => goBack('/(tabs)/receipts')}
        requestTestID="receipt-scanner-request-permission"
        closeTestID="receipt-scanner-permission-close"
      >
        <Pressable
          testID="receipt-scanner-gallery-fallback"
          onPress={handlePickFromGallery}
          accessibilityRole="button"
          accessibilityLabel="Choisir une photo dans la galerie"
          style={pointerCursor}
        >
          <Text fontSize={13} fontWeight="700" color={palette.mintPaleText} textAlign="center">
            Choisir une photo dans la galerie
          </Text>
        </Pressable>
      </CameraPermissionModal>
    )
  }

  return (
    <YStack flex={1}>
      <CameraView testID="receipt-scanner-camera" ref={cameraRef} style={{ flex: 1 }} />
      {/* A framing guide and one instruction: a badly-framed shot is the
          extraction's main failure mode, and nothing used to guide it. */}
      <YStack
        position="absolute"
        top="14%"
        bottom="22%"
        left="12%"
        right="12%"
        borderRadius={18}
        style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}
      />
      <YStack position="absolute" bottom="14%" left={0} right={0} alignItems="center" style={{ pointerEvents: 'none' }}>
        <YStack backgroundColor="rgba(0,0,0,0.45)" borderRadius={999} paddingVertical="$2" paddingHorizontal="$4">
          <Text fontSize={13} fontWeight="700" color="#FFFFFF">
            Cadre le ticket entier, bien à plat
          </Text>
        </YStack>
      </YStack>
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Pressable
          testID="receipt-scanner-close"
          onPress={() => goBack('/(tabs)/receipts')}
          accessibilityRole="button"
          accessibilityLabel="Fermer le scanner"
          style={[pointerCursor, { padding: 12 }]}
        >
          {/* A scrim behind the glyph: white-on-white was invisible against a
              fridge door, a ceiling, or a pale receipt. */}
          <YStack
            width={44}
            height={44}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(0,0,0,0.45)"
          >
            <XIcon size={22} color="#FFFFFF" />
          </YStack>
        </Pressable>
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <YStack flexDirection="row" justifyContent="center" alignItems="center" gap="$4" padding="$4">
          <Pressable
            testID="receipt-scanner-gallery"
            onPress={handlePickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choisir une photo dans la galerie"
            style={pointerCursor}
          >
            <YStack backgroundColor="rgba(255,255,255,0.85)" borderRadius={999} paddingVertical="$2.5" paddingHorizontal="$4">
              <Text fontSize={13} fontWeight="700" color={palette.ink}>
                Galerie
              </Text>
            </YStack>
          </Pressable>
          <Pressable
            testID="receipt-scanner-capture"
            onPress={handleCapture}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Prendre la photo"
            style={pointerCursor}
          >
            <YStack width={64} height={64} borderRadius={32} backgroundColor={palette.accentLime} borderWidth={4} borderColor="#FFFFFF" />
          </Pressable>
        </YStack>
      </SafeAreaView>
    </YStack>
  )
}
