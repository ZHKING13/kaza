import { FlaskConical } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { fonts, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/**
 * Signale le mode démo (données fictives, aucun message envoyé).
 * Couleur neutre : le jaune est réservé au statut « Partiel ».
 */
export function DemoBanner({ children, action }: { children: string; action?: { label: string; onPress: () => void } }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        gap: space.xs,
        backgroundColor: c.surfaceAlt,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.sm,
      }}>
      <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' }}>
        <FlaskConical size={18} color={c.accent} style={{ marginTop: 1 }} />
        <Text variant="small" style={{ flex: 1 }}>
          {children}
        </Text>
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            marginLeft: 26,
            minHeight: 40,
            paddingHorizontal: space.sm,
            borderRadius: radius.sm,
            justifyContent: 'center',
            backgroundColor: pressed ? c.primaryPressed : c.primary,
          })}>
          <Text variant="small" color={c.onPrimary} style={{ fontFamily: fonts.semibold }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
