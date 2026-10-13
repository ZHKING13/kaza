import { Pressable } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export function Chip({ label, selected, onPress, color }: { label: string; selected: boolean; onPress: () => void; color?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: space.md,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primarySoft : pressed ? c.surfaceAlt : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
      })}>
      <Text variant="label" color={selected ? c.primary : (color ?? c.text)}>
        {label}
      </Text>
    </Pressable>
  );
}
