import { Pressable, View } from 'react-native';

import { fonts, space, useTheme } from '@/theme';

import { Text } from './Text';

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
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border }}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderBottomColor: on ? c.primary : 'transparent',
              marginBottom: -1,
              paddingHorizontal: space.xs,
            }}>
            <Text variant="body" color={on ? c.primary : c.textMuted} style={{ fontFamily: on ? fonts.semibold : fonts.medium }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
