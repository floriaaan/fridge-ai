import { useState } from 'react'
import { Pressable, TextInput } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple } from '../shared/material.js'
import type { HaTodoEntity } from '../../domain/home-assistant/ha-link.js'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function TodoEntityRow({
  entity,
  selected,
  onPress,
}: {
  entity: HaTodoEntity
  selected: boolean
  onPress: () => void
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  return (
    <Pressable
      testID={`todo-entity-${entity.entityId}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={entity.friendlyName}
      android_ripple={ripple(palette.ink)}
      style={pointerCursor}
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingVertical="$3"
        paddingHorizontal="$3"
        borderRadius={14}
        backgroundColor={selected ? palette.accentLime : 'transparent'}
      >
        <YStack>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>
            {entity.friendlyName}
          </Text>
          <Text fontSize={12} color={palette.inkSecondary}>
            {entity.entityId}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  )
}

export function TodoEntityPicker({
  entities,
  selectedEntityId,
  onSelect,
}: {
  entities: HaTodoEntity[]
  selectedEntityId: string | null
  onSelect: (entityId: string, friendlyName: string) => void
}) {
  const palette = useSoftPalette()
  const [search, setSearch] = useState('')
  const filtered = entities.filter((entity) => {
    const query = normalize(search)
    if (!query) return true
    return normalize(entity.friendlyName).includes(query) || normalize(entity.entityId).includes(query)
  })

  return (
    <YStack gap="$2">
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher une liste"
        placeholderTextColor={palette.inkSecondary}
        accessibilityLabel="Rechercher une liste"
        style={{
          minHeight: 44,
          borderRadius: 14,
          paddingHorizontal: 16,
          fontSize: 14,
          color: palette.ink,
          backgroundColor: palette.cream,
        }}
      />
      <YStack>
        {filtered.map((entity) => (
          <TodoEntityRow
            key={entity.entityId}
            entity={entity}
            selected={entity.entityId === selectedEntityId}
            onPress={() => onSelect(entity.entityId, entity.friendlyName)}
          />
        ))}
        {filtered.length === 0 ? (
          <Text fontSize={13} color={palette.inkSecondary} paddingVertical="$2">
            Aucune liste ne correspond.
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}
