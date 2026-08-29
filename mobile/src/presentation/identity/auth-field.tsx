import { useState } from 'react'
import { TextInput, type TextInputProps } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/** Label above, rounded field below, lime focus ring — replaces the raw Tamagui `Input`. */
export function AuthField({
  label,
  testID,
  ...inputProps
}: TextInputProps & { label: string; testID?: string }) {
  const palette = useSoftPalette()
  const [focused, setFocused] = useState(false)
  return (
    <YStack gap="$1.5">
      <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        testID={testID}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true)
          inputProps.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          inputProps.onBlur?.(e)
        }}
        placeholderTextColor={palette.inkSecondary}
        style={{
          // minHeight, not height: at large Dynamic Type / font-scale
          // settings the text needs room to grow taller than 48 — a
          // fixed height would clip it instead of letting the field grow
          // (an audit finding: every fixed-height control was a risk).
          minHeight: 48,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 14,
          color: palette.ink,
          backgroundColor: palette.cream,
          borderWidth: 2,
          borderColor: focused ? palette.accentLime : 'transparent',
        }}
      />
    </YStack>
  )
}
