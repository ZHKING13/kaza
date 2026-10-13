import { View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** « Étape 1 sur 2 » avec barre de progression. */
export function StepHeader({ step, total, title, body }: { step: number; total: number; title: string; body?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Étape ${step} sur ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: i < step ? c.primary : c.border }} />
        ))}
      </View>
      <Text variant="caption" tone="muted">
        ÉTAPE {step} SUR {total}
      </Text>
      <Text variant="h1" accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text tone="muted">{body}</Text> : null}
    </View>
  );
}
