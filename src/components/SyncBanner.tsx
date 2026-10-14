import { CloudOff, TriangleAlert } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useStore } from '@/data/store';
import { fonts, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

function Banner({
  icon: Icon,
  color,
  title,
  lines,
  action,
}: {
  icon: typeof CloudOff;
  color: string;
  title: string;
  lines: string[];
  action: { label: string; onPress: () => void };
}) {
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
        <Icon size={18} color={color} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="small" style={{ fontFamily: fonts.semibold }}>
            {title}
          </Text>
          {lines.map((line, i) => (
            <Text key={i} variant="small" tone="muted">
              {line}
            </Text>
          ))}
        </View>
      </View>
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
          backgroundColor: pressed ? c.surface : 'transparent',
          borderWidth: 1,
          borderColor: c.border,
        })}>
        <Text variant="small" tone="primary" style={{ fontFamily: fonts.semibold }}>
          {action.label}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * État de la file d'envoi (compte en ligne) : écritures faites sans réseau, en attente d'envoi, et
 * écritures refusées par le serveur au moment de l'envoi.
 */
export function SyncBanner() {
  const { c, status } = useTheme();
  const { outbox, outboxFailures, retryOutbox, dismissOutboxFailures } = useStore();
  if (!outbox.length && !outboxFailures.length) return null;
  const n = outbox.length;
  const f = outboxFailures.length;
  return (
    <View style={{ gap: space.xs }}>
      {n ? (
        <Banner
          icon={CloudOff}
          color={c.textMuted}
          title={`${n} enregistrement${n > 1 ? 's' : ''} en attente d’envoi`}
          lines={[
            'Enregistré sur ce téléphone. Envoi automatique dès le retour du réseau.',
            ...outbox.slice(0, 3).map((e) => `• ${e.label}`),
            ...(n > 3 ? [`• et ${n - 3} autre${n - 3 > 1 ? 's' : ''}`] : []),
          ]}
          action={{ label: 'Réessayer maintenant', onPress: retryOutbox }}
        />
      ) : null}
      {f ? (
        <Banner
          icon={TriangleAlert}
          color={status.late.fg}
          title={`${f} enregistrement${f > 1 ? 's' : ''} refusé${f > 1 ? 's' : ''} par le serveur`}
          lines={outboxFailures.map((x) => `• ${x.label} : ${x.message}`)}
          action={{ label: 'J’ai compris', onPress: dismissOutboxFailures }}
        />
      ) : null}
    </View>
  );
}
