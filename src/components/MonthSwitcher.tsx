import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { addMonthsToPeriod } from '@/data/rent';
import { useStore } from '@/data/store';
import { useViewPeriod } from '@/data/viewPeriod';
import { formatPeriod, periodOf } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** Mois au-delà du mois en cours que l'on peut consulter (avances) */
const AHEAD = 12;

/**
 * « ‹ octobre 2026 › » : change le mois affiché sur l'Accueil, les Locataires et la fiche du bien.
 * Du premier mois d'un bail jusqu'à 12 mois après le mois en cours ; « Revenir à … » ramène au mois en cours.
 */
export function MonthSwitcher() {
  const { c } = useTheme();
  const { tenants, payments } = useStore();
  const { period, current, setPeriod } = useViewPeriod();
  const first = useMemo(() => {
    let min = current;
    for (const t of tenants) if (t.entryDate && periodOf(new Date(t.entryDate)) < min) min = periodOf(new Date(t.entryDate));
    for (const p of payments) if (p.period < min) min = p.period;
    return min;
  }, [tenants, payments, current]);
  const last = addMonthsToPeriod(current, AHEAD);
  const canBack = period > first;
  const canNext = period < last;

  const arrow = (label: string, enabled: boolean, onPress: () => void, Icon: typeof ChevronLeft) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.surfaceAlt : 'transparent',
        opacity: enabled ? 1 : 0.3,
      })}>
      <Icon size={22} color={c.text} />
    </Pressable>
  );

  return (
    <View style={{ gap: 2 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          paddingHorizontal: 2,
        }}>
        {arrow('Mois précédent', canBack, () => setPeriod(addMonthsToPeriod(period, -1)), ChevronLeft)}
        <Text
          variant="bodyStrong"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize', fontFamily: fonts.semibold }}>
          {formatPeriod(period)}
        </Text>
        {arrow('Mois suivant', canNext, () => setPeriod(addMonthsToPeriod(period, 1)), ChevronRight)}
      </View>
      {period !== current ? (
        <Pressable accessibilityRole="button" onPress={() => setPeriod(current)} style={{ alignSelf: 'center', padding: space.xs }}>
          <Text variant="small" tone="primary" style={{ fontFamily: fonts.semibold }}>
            Revenir à {formatPeriod(current)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
