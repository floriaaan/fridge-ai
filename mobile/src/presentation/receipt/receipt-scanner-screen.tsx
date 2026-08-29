import { useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
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
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$3" alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.ink} textAlign="center">
            L&apos;accès à la caméra est nécessaire pour scanner un ticket de caisse.
          </Text>
          <Pressable
            testID="receipt-scanner-request-permission"
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
          <Pressable
            testID="receipt-scanner-gallery-fallback"
            onPress={handlePickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choisir une photo dans la galerie"
            style={pointerCursor}
          >
            <Text fontSize={13} fontWeight="700" color={palette.mintPaleText}>
              Choisir une photo dans la galerie
            </Text>
          </Pressable>
        </YStack>
      </SafeAreaView>
    )
  }

  return (
    <YStack flex={1}>
      <CameraView testID="receipt-scanner-camera" ref={cameraRef} style={{ flex: 1 }} />
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Pressable
          testID="receipt-scanner-close"
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
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
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
