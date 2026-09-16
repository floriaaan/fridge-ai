/**
 * Up to 5 photos of the fridge, one at a time, reviewed together on the next
 * screen. Mirrors `receipt-scanner-screen.tsx`'s camera/gallery pattern —
 * the difference is this one collects a batch before moving on, since a
 * fridge rarely fits in a single frame the way a receipt does.
 */
import { useState } from 'react'
import { Image, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { CameraPermissionModal } from '../shared/camera-permission-modal.js'
import { goBack } from '../shared/navigation.js'
import { XIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

const MAX_PHOTOS = 5

export function FridgeScanCameraScreen() {
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  const [photos, setPhotos] = useState<string[]>([])

  function goToReview() {
    router.replace({ pathname: '/fridge-scan/review', params: { imageUris: JSON.stringify(photos) } })
  }

  async function handleCapture(cameraRef: CameraView | null) {
    if (!cameraRef || photos.length >= MAX_PHOTOS) return
    const photo = await cameraRef.takePictureAsync({ quality: 0.7 })
    if (photo?.uri) setPhotos((current) => [...current, photo.uri])
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    })
    if (!result.canceled) {
      setPhotos((current) => [...current, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS))
    }
  }

  function removePhoto(uri: string) {
    setPhotos((current) => current.filter((p) => p !== uri))
  }

  if (!permission?.granted) {
    return (
      <CameraPermissionModal
        palette={palette}
        message="L'accès à la caméra est nécessaire pour photographier ton frigo."
        canAskAgain={permission?.canAskAgain ?? true}
        onRequestPermission={requestPermission}
        onClose={() => goBack('/(tabs)/scan')}
        requestTestID="fridge-scan-camera-request-permission"
        closeTestID="fridge-scan-camera-permission-close"
      >
        <Pressable
          testID="fridge-scan-camera-gallery-fallback"
          onPress={handlePickFromGallery}
          accessibilityRole="button"
          accessibilityLabel="Choisir des photos dans la galerie"
          style={pointerCursor}
        >
          <Text fontSize={13} fontWeight="700" color={palette.mintPaleText} textAlign="center">
            Choisir des photos dans la galerie
          </Text>
        </Pressable>
      </CameraPermissionModal>
    )
  }

  return (
    <YStack flex={1}>
      <CameraViewWithRef testID="fridge-scan-camera" onCapture={handleCapture} disabled={photos.length >= MAX_PHOTOS} />

      <YStack position="absolute" bottom="14%" left={0} right={0} alignItems="center" style={{ pointerEvents: 'none' }}>
        <YStack backgroundColor="rgba(0,0,0,0.45)" borderRadius={999} paddingVertical="$2" paddingHorizontal="$4">
          <Text fontSize={13} fontWeight="700" color={palette.onDark}>
            {photos.length}/{MAX_PHOTOS} photo{photos.length > 1 ? 's' : ''} — prends autant d’angles que nécessaire
          </Text>
        </YStack>
      </YStack>

      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Pressable
          testID="fridge-scan-camera-close"
          onPress={() => goBack('/(tabs)/scan')}
          accessibilityRole="button"
          accessibilityLabel="Fermer le scanner"
          style={[pointerCursor, { padding: 12 }]}
        >
          <YStack width={44} height={44} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor="rgba(0,0,0,0.45)">
            <XIcon size={22} color={palette.onDark} />
          </YStack>
        </Pressable>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        {photos.length > 0 ? (
          <XStack gap="$2" paddingHorizontal="$4" paddingBottom="$2">
            {photos.map((uri) => (
              <Pressable
                key={uri}
                onPress={() => removePhoto(uri)}
                accessibilityRole="button"
                accessibilityLabel="Retirer cette photo"
                style={pointerCursor}
              >
                <YStack>
                  <Image source={{ uri }} style={{ width: 48, height: 48, borderRadius: 8 }} />
                  <YStack
                    position="absolute"
                    top={-4}
                    right={-4}
                    width={18}
                    height={18}
                    borderRadius={999}
                    backgroundColor={palette.expiredBg}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <XIcon size={10} color={palette.expiredText} />
                  </YStack>
                </YStack>
              </Pressable>
            ))}
          </XStack>
        ) : null}
        <YStack flexDirection="row" justifyContent="center" alignItems="center" gap="$4" padding="$4">
          <Pressable
            testID="fridge-scan-camera-gallery"
            onPress={handlePickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choisir des photos dans la galerie"
            style={pointerCursor}
          >
            <YStack backgroundColor="rgba(255,255,255,0.85)" borderRadius={999} paddingVertical="$2.5" paddingHorizontal="$4">
              <Text fontSize={13} fontWeight="700" color={palette.ink}>
                Galerie
              </Text>
            </YStack>
          </Pressable>
          {photos.length > 0 ? (
            <Pressable
              testID="fridge-scan-camera-analyze"
              onPress={goToReview}
              accessibilityRole="button"
              accessibilityLabel={`Analyser ${photos.length} photo${photos.length > 1 ? 's' : ''}`}
              style={pointerCursor}
            >
              <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" paddingHorizontal="$5">
                <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
                  Analyser ({photos.length})
                </Text>
              </YStack>
            </Pressable>
          ) : null}
        </YStack>
      </SafeAreaView>
    </YStack>
  )
}

/**
 * `takePictureAsync` needs the live `CameraView` instance, but that instance
 * is only stable across re-renders behind a ref — a plain `useRef` at the
 * top of the screen would work too, except the screen re-renders on every
 * photo taken, which is harmless but makes "who owns the ref" murkier than
 * scoping it to the one component that uses it.
 */
function CameraViewWithRef({
  testID,
  onCapture,
  disabled,
}: {
  testID: string
  onCapture: (camera: CameraView | null) => void
  disabled: boolean
}) {
  const palette = useSoftPalette()
  const [camera, setCamera] = useState<CameraView | null>(null)
  return (
    <>
      <CameraView testID={testID} ref={setCamera} style={{ flex: 1 }} />
      <YStack
        position="absolute"
        top="14%"
        bottom="22%"
        left="12%"
        right="12%"
        borderRadius={18}
        style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}
      />
      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: '26%', left: 0, right: 0 }}>
        <YStack alignItems="center">
          <Pressable
            testID="fridge-scan-camera-capture"
            onPress={() => onCapture(camera)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Prendre la photo"
            style={pointerCursor}
          >
            <YStack width={64} height={64} borderRadius={32} backgroundColor={palette.accentLime} borderWidth={4} borderColor={palette.onDark} opacity={disabled ? 0.5 : 1} />
          </Pressable>
        </YStack>
      </SafeAreaView>
    </>
  )
}
