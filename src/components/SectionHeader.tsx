import { type Href, router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { space } from '@/theme';

import { Text } from './Text';

export function SectionHeader({ title, actionLabel, href }: { title: string; actionLabel?: string; href?: Href }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs }}>
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && href ? (
        <Pressable hitSlop={12} accessibilityRole="link" onPress={() => router.navigate(href)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text variant="small" tone="primary" style={{ fontFamily: 'IBMPlexSans_500Medium' }}>
              {actionLabel}
            </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
