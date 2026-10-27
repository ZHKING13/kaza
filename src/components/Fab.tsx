import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { usePermissions } from '@/data/store';
import { elevation, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** Action n° 1 de l'application : encaisser un loyer. */
export function Fab() {
  const { c } = useTheme();
  // Un lecteur consulte seulement
  const { can } = usePermissions();
  const canCollect = can('payments.record');
  if (!canCollect) return null;
  return (
    <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/encaisser')}
        accessibilityLabel="Encaisser un loyer"
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: space.md,
            bottom: space.md,
            minHeight: 56,
            paddingHorizontal: space.lg,
            borderRadius: radius.full,
            backgroundColor: pressed ? c.primaryPressed : c.primary,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
          },
          elevation.raised,
        ]}>
        <Plus size={22} color={c.onPrimary} strokeWidth={2.5} />
        <Text variant="bodyStrong" color={c.onPrimary}>
          Encaisser
        </Text>
      </Pressable>
  );
}
