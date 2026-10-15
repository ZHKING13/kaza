import { router } from 'expo-router';
import { Crown } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { plans } from '@/data/plans';
import { usePermissions, usePlan } from '@/data/store';
import { formatDate } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

/** Accueil : fin d'essai proche, offre à renouveler, ou espace passé en offre gratuite au-delà de ses limites. */
export function OfferBanner() {
  const { c, status } = useTheme();
  const { isOwner } = usePermissions();
  const { subscription: s, limits, unitsUsed } = usePlan();
  if (!s || !isOwner) return null;
  const over = limits.units !== null && unitsUsed > limits.units;
  const text =
    s.status === 'trial' && (s.daysLeft ?? 99) <= 7
      ? `Votre essai Pro se termine le ${formatDate(s.endsAt!)}. Choisissez une offre pour garder vos relances et votre équipe.`
      : s.status === 'grace'
        ? `Votre offre ${plans[s.plan].label} est échue. Renouvelez-la avant le ${formatDate(s.endsAt!)}.`
        : (s.status === 'expired' || s.status === 'free') && over
          ? `Offre gratuite : ${unitsUsed} logements pour ${limits.units} compris. Tout reste consultable ; passez à une offre pour en ajouter.`
          : null;
  if (!text) return null;
  const urgent = s.status === 'grace';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/offre')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        borderRadius: radius.md,
        padding: space.md,
        backgroundColor: urgent ? status.late.bg : c.primarySoft,
      }}>
      <Crown size={20} color={urgent ? status.late.fg : c.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="small" color={urgent ? status.late.fg : c.text}>
          {text}
        </Text>
        <Text variant="small" tone="primary">
          Voir les offres
        </Text>
      </View>
    </Pressable>
  );
}
