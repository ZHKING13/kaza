import { Pressable, ScrollView } from 'react-native';

import { fonts, space, useTheme } from '@/theme';

import { Text } from './Text';

/**
 * Onglets d'un écran. Chaque libellé tient sur une ligne : les onglets se partagent la largeur quand ils tiennent,
 * sinon la rangée défile horizontalement (petits écrans, grands textes d'accessibilité).
 */
export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const { c } = useTheme();
  const dense = tabs.length > 3;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.border }}
      contentContainerStyle={{ flexGrow: 1 }}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={{
              flexGrow: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderBottomColor: on ? c.primary : 'transparent',
              paddingHorizontal: dense ? space.xs : space.md,
            }}>
            <Text
              variant={dense ? 'small' : 'body'}
              numberOfLines={1}
              color={on ? c.primary : c.textMuted}
              style={{ fontFamily: on ? fonts.semibold : fonts.medium }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
