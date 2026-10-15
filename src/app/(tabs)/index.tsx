import { Bell, CircleAlert, DoorOpen, Send } from 'lucide-react-native';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Fab } from '@/components/Fab';
import { KazaMark } from '@/components/KazaMark';
import { LeaseAlerts } from '@/components/LeaseAlerts';
import { OfferBanner } from '@/components/OfferBanner';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { DemoBanner } from '@/components/DemoBanner';
import { PaymentRow } from '@/components/PaymentRow';
import { StartChecklist } from '@/components/StartChecklist';
import { createAccountFromDemo } from '@/lib/demo';
import { SyncBanner } from '@/components/SyncBanner';
import { Text } from '@/components/Text';
import { useMonthTotals, usePermissions, useStore, useTenantSummaries } from '@/data/store';
import { formatAmount, formatNumber, formatPeriod } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

function greeting(d: Date) {
  return d.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
}

export default function Accueil() {
  const { c, status } = useTheme();
  const { payments, today, period, profile, mode, signOut, invitations, organizations, organizationId } = useStore();
  const { canCollect } = usePermissions();
  const current = organizations.length > 1 ? organizations.find((o) => o.id === organizationId) : undefined;
  const summaries = useTenantSummaries();
  const totals = useMonthTotals();
  const pct = totals.expected ? Math.round((totals.collected / totals.expected) * 100) : 0;
  const recent = payments.slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen
        subtitle={current ? `${current.name} · ${greeting(today).toLowerCase()},` : greeting(today) + ','}
        title={profile.firstName}
        bottomInset={96}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode === 'demo' ? 'Notifications, 3 nouvelles' : 'Notifications'}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Bell size={22} color={c.text} />
              {mode === 'demo' ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 11,
                    right: 12,
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: status.late.fg,
                    borderWidth: 2,
                    borderColor: c.surface,
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        }>
        {mode === 'demo' ? (
          <DemoBanner action={{ label: 'Créer mon compte', onPress: () => createAccountFromDemo(signOut) }}>
            Vous explorez la démo : biens et locataires fictifs.
          </DemoBanner>
        ) : null}
        <SyncBanner />
        <OfferBanner />
        {/* Résumé du mois : la réponse à « où en sont mes loyers ? » */}
        {summaries.length ? (
          <>
            <View style={{ backgroundColor: c.primary, borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="small" color={c.onPrimary} style={{ opacity: 0.9 }}>
                  Encaissé en {formatPeriod(period).split(' ')[0]}
                </Text>
                <KazaMark size={22} color={c.onPrimary} />
              </View>
              <Amount value={totals.collected} variant="amountXL" color={c.onPrimary} />
              <View
                accessibilityLabel={`${pct} % des loyers encaissés`}
                style={{ height: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.onPrimary, borderRadius: radius.full }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" color={c.onPrimary}>
                  {pct} % de {formatNumber(totals.expected)}
                </Text>
                <Text variant="caption" color={c.onPrimary}>
                  {totals.paidCount} / {totals.tenantCount} locataire{totals.tenantCount > 1 ? 's' : ''} à jour
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Card style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <CircleAlert size={16} color={status.late.fg} />
                  <Text variant="small" tone="muted">
                    Impayés
                  </Text>
                </View>
                <Amount
                  value={totals.outstanding}
                  currency={false}
                  variant="h2"
                  color={status.late.fg}
                  style={{ fontVariant: ['tabular-nums'] }}
                />
              </Card>
              <Card style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <DoorOpen size={16} color={c.textMuted} />
                  <Text variant="small" tone="muted">
                    Unités vacantes
                  </Text>
                </View>
                <Text variant="h2">{totals.vacantCount}</Text>
              </Card>
            </View>
          </>
        ) : null}

        {totals.lateCount > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              backgroundColor: status.late.bg,
              borderRadius: radius.md,
              padding: space.sm,
              paddingLeft: space.md,
            }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color={status.late.fg}>
                {totals.lateCount} locataire{totals.lateCount > 1 ? 's' : ''} en retard
              </Text>
              <Text variant="small" color={status.late.fg}>
                {formatAmount(totals.outstanding)} à recevoir
              </Text>
            </View>
            {canCollect ? (
              <Button label="Relancer" icon={Send} variant="danger" compact onPress={() => router.push('/locataires')} />
            ) : null}
          </View>
        ) : null}

        {invitations.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/invitations')}
            style={{ backgroundColor: c.primarySoft, borderRadius: radius.md, padding: space.md, gap: 2 }}>
            <Text variant="bodyStrong" tone="primary">
              {invitations.length === 1
                ? `${invitations[0].organization.name} vous invite à rejoindre son espace`
                : `${invitations.length} espaces vous invitent à les rejoindre`}
            </Text>
            <Text variant="small" tone="muted">
              Voir l’invitation
            </Text>
          </Pressable>
        ) : null}

        <LeaseAlerts />

        <StartChecklist />

        {recent.length ? (
          <>
            <SectionHeader title="Paiements récents" actionLabel="Voir tout" href="/paiements" />
            <Card padded={false}>
              {recent.map((p, i) => (
                <PaymentRow key={p.id} payment={p} summaries={summaries} first={i === 0} />
              ))}
            </Card>
          </>
        ) : null}
      </Screen>
      {summaries.length ? <Fab /> : null}
    </View>
  );
}
