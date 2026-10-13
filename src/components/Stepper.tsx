import { Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** Sélecteur de nombre entier avec boutons − / + de 48 dp. */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 12,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  unit: (n: number) => string;
}) {
  const { c } = useTheme();
  const btn = (icon: typeof Plus, next: number, a11y: string, disabled: boolean) => {
    const Icon = icon;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        disabled={disabled}
        onPress={() => onChange(next)}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: pressed ? c.surfaceAlt : c.surface,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.35 : 1,
        })}>
        <Icon size={20} color={c.primary} strokeWidth={2.5} />
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: unit(value) }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      {btn(Minus, Math.max(min, value - 1), `Diminuer : ${label}`, value <= min)}
      <Text variant="h3" style={{ minWidth: 72, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {unit(value)}
      </Text>
      {btn(Plus, Math.min(max, value + 1), `Augmenter : ${label}`, value >= max)}
    </View>
  );
}
