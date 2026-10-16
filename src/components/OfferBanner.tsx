import { router } from 'expo-router';
import { Crown, Gift } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { plans } from '@/data/plans';
import { remote, type SubscriptionDetail } from '@/data/remote';
import { usePermissions, usePlan, useStore } from '@/data/store';
import { formatDate } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

type Welcome = NonNullable<SubscriptionDetail['welcome']>;

// Offre de bienvenue lue au plus toutes les 10 minutes, par espace
const welcomeCache = new Map<string, { at: number; welcome: Welcome | null }>();

/** Offre de bienvenue du propriétaire, tant qu'il n'a rien payé (lue sur le serveur). */
function useWelcomeOffer(enabled: boolean): Welcome | null {
  const { organizationId } = useStore();
  const cached = organizationId ? welcomeCache.get(organizationId) : undefined;
  const [welcome, setWelcome] = useState<Welcome | null>(cached?.welcome ?? null);
  useEffect(() => {
    if (!enabled || !organizationId) return;
    const hit = welcomeCache.get(organizationId);
    if (hit && Date.now() - hit.at < 600_000) {
      setWelcome(hit.welcome);
      return;
    }
    let alive = true;
    remote
      .subscription(organizationId)
      .then((detail) => {
        welcomeCache.set(organizationId, { at: Date.now(), welcome: detail.welcome });
        if (alive) setWelcome(detail.welcome);
      })
      // Hors connexion : pas d'encadré
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, organizationId]);
  return enabled ? welcome : null;
}

/**
 * Accueil (propriétaire) : offre de bienvenue à saisir, fin d'essai proche, offre à renouveler, ou espace en offre
 * gratuite au-delà de ses limites.
 */
export function OfferBanner() {
  const { c, status } = useTheme();
  const { isOwner } = usePermissions();
  const { subscription: s, limits, unitsUsed } = usePlan();
  const welcome = useWelcomeOffer(!!s && isOwner && (s.status === 'free' || s.status === 'expired'));
  if (!s || !isOwner) return null;
  const over = limits.units !== null && unitsUsed > limits.units;
  const percent = (months: number) => welcome?.discounts.find((d) => d.months === months)?.percent ?? 0;
  const text = welcome
    ? `Offre de bienvenue : -${percent(3)} % sur 3 mois ou -${percent(12)} % sur 12 mois de votre première offre, ${
        welcome.daysLeft > 1 ? `plus que ${welcome.daysLeft} jours` : 'dernier jour'
      }.`
    : s.status === 'trial' && (s.daysLeft ?? 99) <= 7
      ? `Votre essai Pro se termine le ${formatDate(s.endsAt!)}. Choisissez une offre pour garder vos relances et votre équipe.`
      : s.status === 'grace'
        ? `Votre offre ${plans[s.plan].label} est échue. Renouvelez-la avant le ${formatDate(s.endsAt!)}.`
        : (s.status === 'expired' || s.status === 'free') && over
          ? `Offre gratuite : ${unitsUsed} logements pour ${limits.units} compris. Tout reste consultable ; passez à une offre pour en ajouter.`
          : null;
  if (!text) return null;
  const urgent = s.status === 'grace';
  const Icon = welcome ? Gift : Crown;
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
      <Icon size={20} color={urgent ? status.late.fg : welcome ? c.primary : c.accent} />
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
