import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { space, useTheme } from '@/theme';

import { Text } from './Text';

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.xxl, paddingHorizontal: space.lg }}>
      <Icon size={32} color={c.textMuted} />
      <Text variant="h3" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
        {body}
      </Text>
    </View>
  );
}
