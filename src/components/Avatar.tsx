import { View } from 'react-native';

import { initials } from '@/lib/format';
import { radius, useTheme } from '@/theme';

import { Text } from './Text';

export function Avatar({ first, last, size = 40 }: { first: string; last: string; size?: number }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: c.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text variant="label" color={c.primary} style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}>
        {initials(first, last)}
      </Text>
    </View>
  );
}
