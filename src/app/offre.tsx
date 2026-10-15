import { Stack, useFocusEffect } from 'expo-router';
import { Check, Crown, FileText, Wallet } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { FormError } from '@/components/FormError';
import { PdfButton } from '@/components/PdfButton';
import { Text } from '@/components/Text';
import { type BillingMonths, billingMonths, type PlanId, paidPlans, planPrice, plans, statusLabels } from '@/data/plans';
import { remote, type SubscriptionDetail } from '@/data/remote';
import { usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { invoiceHtml } from '@/lib/documents';
import { formatAmount, formatDate } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

const monthLabels: Record<BillingMonths, string> = { 1: '1 mois', 3: '3 mois', 12: '12 mois · 2 offerts' };

function features(id: PlanId): string[] {
  const l = plans[id].limits;
  return [
    `${l.units === null ? 'Logements illimités' : `Jusqu’à ${l.units} logements`}`,
    l.members === null ? 'Équipe illimitée' : l.members === 1 ? 'Vous seul' : `Vous et ${l.members - 1} membres (gérant, collecteur)`,
    l.messagesPerMonth > 0 ? `${l.messagesPerMonth} messages WhatsApp envoyés par Kaza / mois` : 'Relances depuis votre WhatsApp',
    ...(l.onlinePayments ? ['Liens de paiement Wave, Orange, MTN, Moov'] : []),
    ...(l.branding ? ['Quittances à vos couleurs (logo, cachet)'] : []),
    ...(l.activityLog ? ['Journal d’activité'] : []),
  ];
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const { c, status } = useTheme();
  const ratio = limit ? Math.min(used / limit, 1) : 0;
  // Au-delà de la limite (après un passage à une offre plus petite) : en rouge
  const full = limit !== null && used > limit;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="small">{label}</Text>
        <Text variant="small" color={full ? status.late.fg : c.textMuted} style={{ fontVariant: ['tabular-nums'] }}>
          {limit === null ? `${used} · illimité` : `${used} / ${limit}`}
        </Text>
      </View>
      {limit !== null && limit > 0 ? (
        <View style={{ height: 6, borderRadius: radius.full, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: full ? status.late.fg : c.primary }} />
        </View>
      ) : null}
    </View>
  );
}

/** Offre de l'espace : où l'on en est, ce que chaque offre permet, paiement par mobile money, factures. */
export default function OffreScreen() {
  const { c, status } = useTheme();
  const { organizationId, identity, organizations, pendingSubscription, startSubscriptionPayment } = useStore();
  const { isOwner } = usePermissions();
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [months, setMonths] = useState<BillingMonths>(12);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const paying = pendingSubscription?.orgId === organizationId ? pendingSubscription : null;

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      const next = await remote.subscription(organizationId);
      setDetail(next);
      setError(undefined);
      return next;
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [organizationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Le paiement confirmé (message bref, suivi par le store) : on relit l'offre affichée
  const wasPaying = useRef(false);
  useEffect(() => {
    if (wasPaying.current && !paying) void load();
    wasPaying.current = !!paying;
  }, [paying, load]);

  const choose = async (plan: PlanId) => {
    if (!organizationId) return;
    setBusy(true);
    setError(undefined);
    try {
      const { invoice, checkoutUrl } = await remote.subscriptionCheckout(organizationId, plan, months);
      startSubscriptionPayment(invoice.id, plan);
      if (Platform.OS === 'web') globalThis.open?.(checkoutUrl, '_blank');
      else await Linking.openURL(checkoutUrl);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const orgName = identity.legalName || organizations.find((o) => o.id === organizationId)?.name || 'Votre espace';

  if (!organizationId) {
    return (
      <View style={{ flex: 1, padding: space.md, backgroundColor: c.bg }}>
        <Text tone="muted">Les offres s’appliquent aux comptes en ligne.</Text>
      </View>
    );
  }

  const current = detail?.effectivePlan ?? 'free';
  const headline = !detail
    ? 'Chargement…'
    : detail.status === 'trial'
      ? `Essai Pro gratuit : ${detail.daysLeft} jour${(detail.daysLeft ?? 0) > 1 ? 's' : ''} restant${(detail.daysLeft ?? 0) > 1 ? 's' : ''}`
      : detail.status === 'active'
        ? `Offre ${plans[detail.plan].label}, payée jusqu’au ${formatDate(detail.paidUntil!)}`
        : detail.status === 'grace'
          ? `Offre ${plans[detail.plan].label} échue : renouvelez avant le ${formatDate(detail.endsAt!)}`
          : 'Offre gratuite';
  const hint = !detail
    ? ''
    : detail.status === 'trial'
      ? `Toutes les fonctions Pro jusqu’au ${formatDate(detail.endsAt!)}. Ensuite, choisissez une offre ; sinon l’espace passe en offre gratuite, sans rien perdre.`
      : detail.status === 'grace'
        ? 'Vos fonctions restent ouvertes pendant 7 jours. Ensuite, l’espace passe en offre gratuite (rien n’est effacé).'
        : detail.status === 'expired' || detail.status === 'free'
          ? 'Vous gardez l’accès à tout pour consulter, encaisser et imprimer vos quittances. Ajouter des logements, l’équipe et les envois par Kaza demandent une offre payante.'
          : 'Vous pouvez prolonger ou changer d’offre à tout moment : les jours déjà payés sont gardés.';

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: 'Mon offre' }} />

      <Card style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Crown size={22} color={c.accent} />
          <Text variant="h3" style={{ flex: 1 }}>
            {headline}
          </Text>
          {detail ? (
            <Text variant="small" color={detail.status === 'grace' || detail.status === 'expired' ? status.late.fg : c.textMuted}>
              {statusLabels[detail.status]}
            </Text>
          ) : null}
        </View>
        <Text variant="small" tone="muted">
          {hint}
        </Text>
        {detail ? (
          <View style={{ gap: space.sm, marginTop: space.xs }}>
            <Usage label="Logements" used={detail.usage.units} limit={detail.limits.units} />
            <Usage label="Équipe" used={detail.usage.members} limit={detail.limits.members} />
            <Usage label="Messages envoyés par Kaza ce mois" used={detail.usage.messagesThisMonth} limit={detail.limits.messagesPerMonth} />
          </View>
        ) : null}
      </Card>

      {paying ? (
        <Card style={{ backgroundColor: c.primarySoft, gap: 4 }}>
          <Text variant="bodyStrong" tone="primary">
            Paiement en cours…
          </Text>
          <Text variant="small" tone="muted">
            Payez par Wave, Orange Money, MTN ou Moov sur la page qui vient de s’ouvrir. Vous serez prévenu dès la
            confirmation, même si vous quittez cet écran.
          </Text>
        </Card>
      ) : null}
      <FormError message={error} />

      <View style={{ gap: space.xs }}>
        <Text variant="h3" accessibilityRole="header">
          Durée
        </Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {billingMonths.map((m) => (
            <Chip key={m} label={monthLabels[m]} selected={months === m} onPress={() => setMonths(m)} />
          ))}
        </View>
      </View>

      {paidPlans.map((id) => {
        const amount = planPrice(id, months);
        const isCurrent = current === id && (detail?.status === 'active' || detail?.status === 'grace');
        return (
          <Card key={id} style={{ gap: space.sm, borderColor: isCurrent ? c.primary : c.border, borderWidth: isCurrent ? 2 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
              <Text variant="h2" style={{ flex: 1 }}>
                {plans[id].label}
              </Text>
              <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                {formatAmount(plans[id].monthlyPrice)}
              </Text>
              <Text variant="small" tone="muted">
                / mois
              </Text>
            </View>
            <Text variant="small" tone="muted">
              {plans[id].pitch}
            </Text>
            {features(id).map((f) => (
              <View key={f} style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' }}>
                <Check size={16} color={c.primary} style={{ marginTop: 3 }} />
                <Text variant="small" style={{ flex: 1 }}>
                  {f}
                </Text>
              </View>
            ))}
            {isOwner ? (
              <Button
                label={`${isCurrent ? 'Prolonger' : 'Choisir'} · ${formatAmount(amount)}${months === 12 ? ' / an' : months === 3 ? ' / 3 mois' : ''}`}
                icon={Wallet}
                variant={id === 'pro' ? 'primary' : 'secondary'}
                disabled={busy || !!paying || detail?.billingAvailable === false}
                onPress={() => choose(id)}
              />
            ) : null}
          </Card>
        );
      })}
      {!isOwner ? (
        <Text variant="small" tone="muted">
          Seul le propriétaire de l’espace peut payer l’offre.
        </Text>
      ) : detail?.billingAvailable === false ? (
        <Text variant="small" tone="muted">
          Le paiement des offres arrive bientôt.
        </Text>
      ) : null}

      {detail?.invoices.length ? (
        <View style={{ gap: space.xs }}>
          <Text variant="h3" accessibilityRole="header">
            Factures
          </Text>
          <Card padded={false}>
            {detail.invoices.map((inv, i) => (
              <View
                key={inv.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  padding: space.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                }}>
                <FileText size={18} color={c.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">
                    {plans[inv.plan].label} · {inv.months} mois
                  </Text>
                  <Text variant="small" tone="muted">
                    {inv.number} · {inv.paidAt ? formatDate(inv.paidAt) : ''} · {formatAmount(inv.amount)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
          <PdfButton
            label="Dernière facture (PDF)"
            fileName={`Facture-${detail.invoices[0].number ?? 'Kaza'}`}
            html={() =>
              invoiceHtml({
                invoice: { ...detail.invoices[0], planLabel: plans[detail.invoices[0].plan].label },
                customer: {
                  name: orgName,
                  lines: [identity.address, identity.registrationNumber ? `RCCM ${identity.registrationNumber}` : null].filter(
                    (l): l is string => !!l,
                  ),
                },
              })
            }
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
