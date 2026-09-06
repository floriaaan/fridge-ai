import { router } from 'expo-router'
import { InviteScannerScreen } from '../../presentation/onboarding/invite-scanner-screen.js'
import { goBack } from '../../presentation/shared/navigation.js'

export default function ScanInviteCodeScreen() {
  return (
    <InviteScannerScreen
      onScanned={(code) => {
        // Back onto the threshold that pushed us, with the code set as a
        // parameter — not `replace` into a fresh copy, which would discard the
        // foyer name someone may already have typed on the card above.
        router.back()
        router.setParams({ code })
      }}
      onClose={() => goBack('/(onboarding)')}
    />
  )
}
