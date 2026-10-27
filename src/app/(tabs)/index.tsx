import { Bell, CalendarClock, ChevronRight, CircleAlert, DoorOpen, Hand, Receipt, Send } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Fab } from '@/components/Fab';
import { KazaMark } from '@/components/KazaMark';
import { LeaseAlerts } from '@/components/LeaseAlerts';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { OfferBanner } from '@/components/OfferBanner';
import { PushPrompt } from '@/components/PushPrompt';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { DemoBanner } from '@/components/DemoBanner';
import { PaymentRow } from '@/components/PaymentRow';
import { StartChecklist } from '@/components/StartChecklist';
import { createAccountFromDemo, demoSignupLabel } from '@/lib/demo';
import { SyncBanner } from '@/components/SyncBanner';
import { Text } from '@/components/Text';
import { useMonthTotals, usePermissions, useReport, useStore, useTenantSummaries } from '@/data/store';
import { useViewPeriod } from '@/data/viewPeriod';
import { formatAmount, formatNumber, formatPeriod } from '@/lib/format';
import { syncUnread, useUnreadNotifications } from '@/lib/notifications';
import { fonts, radius, space, useTheme } from '@/theme';

function greeting(d: Date) {
  return d.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
}

export default function Accueil() {
  const { c, status } = useTheme();
  const { payments, today, period, profile, mode, remote, signOut, invitations, organizations, organizationId, declarations } = useStore();
  const unread = useUnreadNotifications();
  useFocusEffect(
    useCallback(() => {
      syncUnread(mode, remote);
    }, [mode, remote]),
  );
  const { can } = usePermissions();
  const canCollect = can('messages.send');
  const current = organizations.length > 1 ? organizations.find((o) => o.id === organizationId) : undefined;
  const { period: shown } = useViewPeriod();
  const summaries = useTenantSummaries();
  const monthSummaries = useTenantSummaries(shown);
  const totals = useMonthTotals(shown);
  const monthReport = useReport(shown, shown);
  const past = shown < period;
  // Mois à venir : rien n'y est encore dû, seules les avances comptent
  const ahead = shown > period;
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
              accessibilityLabel={unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
              onPress={() => router.push('/notifications')}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: pressed ? c.surfaceAlt : c.surface,
                alignItems: 'center',
                justifyContent: 'center',
              })}>
              <Bell size={22} color={c.text} />
              {unread ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 2,
                    minWidth: 20,
                    height: 20,
                    paddingHorizontal: 5,
                    borderRadius: 10,
                    backgroundColor: c.accent,
                    borderWidth: 2,
                    borderColor: c.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text variant="caption" color={c.onAccent} style={{ fontSize: 11, lineHeight: 13, fontFamily: fonts.semibold }}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        }>
        {mode === 'demo' ? (
          <DemoBanner action={{ label: demoSignupLabel, onPress: () => createAccountFromDemo(signOut) }}>
            Vous explorez la démo : biens et locataires fictifs.
          </DemoBanner>
        ) : null}
        <SyncBanner />
        <OfferBanner />
        <PushPrompt />
        {/* Résumé du mois : la réponse à « où en sont mes loyers ? » */}
        {summaries.length || monthSummaries.length ? <MonthSwitcher /> : null}
        {monthSummaries.length ? (
          <>
            <View style={{ backgroundColor: c.primary, borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="small" color={c.onPrimary} style={{ opacity: 0.9 }}>
                  {ahead ? 'Payé d’avance pour' : 'Encaissé en'} {formatPeriod(shown).split(' ')[0]}
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
                  {totals.paidCount} / {totals.tenantCount} locataire{totals.tenantCount > 1 ? 's' : ''} {ahead ? 'd’avance' : 'à jour'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Card style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {ahead ? <CalendarClock size={16} color={c.textMuted} /> : <CircleAlert size={16} color={status.late.fg} />}
                  <Text variant="small" tone="muted">
                    {ahead ? 'À recevoir' : 'Impayés'}
                  </Text>
                </View>
                <Amount
                  value={totals.outstanding}
                  currency={false}
                  variant="h2"
                  color={ahead ? c.text : status.late.fg}
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
            {monthReport.totals.expenses > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/rapports')}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  padding: space.sm,
                  paddingHorizontal: space.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: pressed ? c.surfaceAlt : c.surface,
                })}>
                <Receipt size={16} color={c.textMuted} />
                <Text variant="small" tone="muted" style={{ flex: 1 }}>
                  Dépenses du mois {formatAmount(monthReport.totals.expenses)}
                </Text>
                <Text variant="bodyStrong" color={monthReport.totals.net < 0 ? status.late.fg : c.primary}>
                  Net {formatAmount(monthReport.totals.net)}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {declarations.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Ouvre les paiements signalés par les locataires"
            onPress={() => router.push('/declarations')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              backgroundColor: pressed ? c.surfaceAlt : c.primarySoft,
              borderRadius: radius.md,
              padding: space.md,
            })}>
            <Hand size={22} color={c.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" tone="primary">
                {declarations.length === 1
                  ? '1 paiement signalé à confirmer'
                  : `${declarations.length} paiements signalés à confirmer`}
              </Text>
              <Text variant="small" tone="muted">
                {formatAmount(declarations.reduce((sum, d) => sum + d.amount, 0))} payés directement par vos locataires
              </Text>
            </View>
            <ChevronRight size={20} color={c.primary} />
          </Pressable>
        ) : null}

        {totals.lateCount > 0 && !ahead ? (
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
                {past ? ` en ${formatPeriod(shown)}` : ''}
              </Text>
              <Text variant="small" color={status.late.fg}>
                {formatAmount(totals.outstanding + totals.arrears)} à recevoir
                {totals.arrears > 0 ? `, dont ${formatAmount(totals.arrears)} d’arriérés` : ''}
              </Text>
            </View>
            {canCollect && !past ? (
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
