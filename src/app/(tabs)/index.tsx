import { Bell, CircleAlert, DoorOpen, Send } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Fab } from '@/components/Fab';
import { KazaMark } from '@/components/KazaMark';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { TenantRow } from '@/components/TenantRow';
import { Text } from '@/components/Text';
import { useMonthTotals, useStore, useTenantSummaries } from '@/data/store';
import { formatAmount, formatNumber, formatPeriod } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

function greeting(d: Date) {
  return d.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
}

export default function Accueil() {
  const { c, status } = useTheme();
  const { payments, today, period } = useStore();
  const summaries = useTenantSummaries();
  const totals = useMonthTotals();
  const pct = totals.expected ? Math.round((totals.collected / totals.expected) * 100) : 0;
  const recent = payments.slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen
        subtitle={greeting(today) + ','}
        title="Kouassi"
        bottomInset={96}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications, 3 nouvelles"
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
            </Pressable>
          </View>
        }>
        {/* Résumé du mois : la réponse à « où en sont mes loyers ? » */}
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
              {totals.paidCount} / {totals.tenantCount} locataires à jour
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
            <Amount value={totals.outstanding} currency={false} variant="h2" color={status.late.fg} style={{ fontVariant: ['tabular-nums'] }} />
          </Card>
          <Card style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <DoorOpen size={16} color={c.textMuted} />
              <Text variant="small" tone="muted">
                Lots vacants
              </Text>
            </View>
            <Text variant="h2">{totals.vacantCount}</Text>
          </Card>
        </View>

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
                {totals.lateCount} locataires en retard
              </Text>
              <Text variant="small" color={status.late.fg}>
                {formatAmount(totals.outstanding)} à recevoir
              </Text>
            </View>
            <Button label="Relancer" icon={Send} variant="danger" compact />
          </View>
        ) : null}

        <SectionHeader title="Paiements récents" actionLabel="Voir tout" href="/paiements" />
        <Card padded={false}>
          {recent.map((p, i) => {
            const s = summaries.find((x) => x.tenant.id === p.tenantId)!;
            return <TenantRow key={p.id} summary={s} method={p.method} amount={p.amount} first={i === 0} />;
          })}
        </Card>
      </Screen>
      <Fab />
    </View>
  );
}
