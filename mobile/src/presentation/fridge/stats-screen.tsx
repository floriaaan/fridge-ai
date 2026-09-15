/**
 * Waste stats — a stack screen reached from the dashboard, not a bottom
 * tab (see `docs/superpowers/specs/2026-09-14-waste-stats-design.md`).
 * Answers three questions a foyer member actually asks: how much did we
 * throw away (€ + count) over a period, is it trending down week to week,
 * and how much of what we ate came from an actual recipe rather than
 * habit. Deliberately excludes a category ranking — that's a distinct,
 * separately-scoped stat the design explicitly left out of this pass.
 */
import { useState } from 'react'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { Chip } from '../shared/chip.js'
import { PillButton } from '../shared/pill-button.js'
import { Skeleton } from '../shared/skeleton.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { goBack } from '../shared/navigation.js'
import { StatCard } from '../dashboard/stat-card.js'
import { Meter } from '../shared/meter.js'
import { WasteTrendChart } from './waste-trend-chart.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { CircleXIcon, TrendingUpIcon, WalletIcon } from '../dashboard/dashboard-icons.js'
import { useProductOutcomeStatsQuery } from '../../application/fridge/product-outcome-stats.query.js'

/** `undefined` days = "Tout", the same convention `getExpiringSoonProducts`'s optional `days` already uses. */
type PeriodOption = { label: string; days: number | undefined; testID: string }

const PERIODS: PeriodOption[] = [
  { label: '7 j', days: 7, testID: 'stats-period-7' },
  { label: '30 j', days: 30, testID: 'stats-period-30' },
  { label: 'Tout', days: undefined, testID: 'stats-period-all' },
]

function formatEuros(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`
}

export function StatsScreen() {
  const palette = useSoftPalette()
  const [days, setDays] = useState<number | undefined>(30)
  const statsQuery = useProductOutcomeStatsQuery(days)
  const refresh = usePullToRefresh(() => statsQuery.refetch())

  const data = statsQuery.data
  const loading = statsQuery.isPending
  const failed = !loading && statsQuery.isError
  const empty = !loading && !failed && data !== undefined && data.discarded.count === 0 && data.consumed.count === 0

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <TrendingUpIcon size={19} color={color} />}
      title="Statistiques"
      onBack={() => goBack('/(tabs)')}
    />
  )

  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={header}>
      <YStack marginTop="$5" gap="$5">
        <XStack gap="$3">
          {PERIODS.map((period) => (
            <Chip
              key={period.testID}
              testID={period.testID}
              label={period.label}
              selected={days === period.days}
              onPress={() => setDays(period.days)}
              palette={palette}
              accessibilityLabel={`Période : ${period.label}`}
            />
          ))}
        </XStack>

        {loading ? (
          <YStack gap="$3">
            <XStack gap="$3">
              <Skeleton height={128} width="50%" radius={20} palette={palette} />
              <Skeleton height={128} width="50%" radius={20} palette={palette} />
            </XStack>
            <Skeleton height={160} radius={20} palette={palette} />
            <Skeleton height={60} radius={20} palette={palette} />
          </YStack>
        ) : null}

        {failed ? (
          <YStack gap="$3" alignItems="flex-start">
            <Text fontSize={14} fontWeight="500" color={palette.expiredText}>
              On n’a pas pu lire les statistiques. Vérifie ta connexion.
            </Text>
            <PillButton
              testID="stats-retry"
              label="Réessayer"
              accessibilityLabel="Réessayer de charger les statistiques"
              onPress={() => statsQuery.refetch()}
              palette={palette}
            />
          </YStack>
        ) : null}

        {empty ? (
          <Text testID="stats-empty" fontSize={14} fontWeight="500" color={palette.inkSecondary}>
            Rien à signaler sur cette période — pas de sortie de produit enregistrée.
          </Text>
        ) : null}

        {data && !empty ? (
          <>
            <XStack gap="$3" alignItems="stretch">
              <StatCard
                testID="stats-discarded-value"
                bg={palette.lavender}
                labelColor={palette.lavenderText}
                valueColor={palette.ink}
                chipColor={palette.chipViolet}
                icon={<WalletIcon size={18} color={palette.onDark} />}
                label="Valeur jetée"
                value={formatEuros(data.discarded.value)}
                corner="a"
                palette={palette}
                accessibilityLabel={`Valeur jetée, ${formatEuros(data.discarded.value)}`}
              />
              <StatCard
                testID="stats-discarded-count"
                bg={palette.cream}
                labelColor={palette.creamText}
                valueColor={palette.ink}
                chipColor={palette.chipOrange}
                icon={<CircleXIcon size={18} color={palette.onDark} />}
                label="Produits jetés"
                value={String(data.discarded.count)}
                corner="b"
                palette={palette}
                accessibilityLabel={`Produits jetés, ${data.discarded.count}`}
              />
            </XStack>

            <YStack gap="$3">
              <Text fontSize={15} fontWeight="800" color={palette.ink}>
                Jeté vs consommé
              </Text>
              <WasteTrendChart testID="stats-trend-chart" buckets={data.buckets} palette={palette} />
            </YStack>

            <Meter
              testID="stats-recipe-share"
              label="Repas cuisinés à partir d’une recette"
              percent={data.recipeSharePercent}
              palette={palette}
            />
          </>
        ) : null}
      </YStack>
    </AppShell>
  )
}
