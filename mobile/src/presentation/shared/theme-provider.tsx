import { useColorScheme } from 'react-native'
import { TamaguiProvider } from 'tamagui'
import type { ReactNode } from 'react'
import { tamaguiConfig } from '../../../tamagui.config'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme()
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      {children}
    </TamaguiProvider>
  )
}
