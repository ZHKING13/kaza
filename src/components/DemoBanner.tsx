import { FlaskConical } from 'lucide-react-native';
import { View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** Signale que la connexion fonctionne sans serveur : aucun message n'est réellement envoyé. */
export function DemoBanner({ children }: { children: string }) {
  const { status } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: space.xs,
        alignItems: 'flex-start',
        backgroundColor: status.partial.bg,
        borderRadius: radius.md,
        padding: space.sm,
      }}>
      <FlaskConical size={18} color={status.partial.fg} style={{ marginTop: 1 }} />
      <Text variant="small" color={status.partial.fg} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
