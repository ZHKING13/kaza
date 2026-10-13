import { View, type ViewProps } from 'react-native';

import { radius, space, useTheme } from '@/theme';

export function Card({ style, padded = true, ...rest }: ViewProps & { padded?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: padded ? space.md : 0,
          overflow: 'hidden',
        },
        style,
      ]}
      {...rest}
    />
  );
}
