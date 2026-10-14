import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, useTheme } from '@/theme';

import { Text } from './Text';

type Props = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  /** Espace réservé en bas (bouton flottant) */
  bottomInset?: number;
  scroll?: boolean;
};

export function Screen({ title, subtitle, right, children, bottomInset = space.xl, scroll = true }: Props) {
  const { c } = useTheme();
  const header = title ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <Text variant="small" tone="muted">
            {subtitle}
          </Text>
        ) : null}
        <Text variant="h1" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: bottomInset, gap: space.md }}
          keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: space.md, gap: space.md }}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
