import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MessageCircle, Phone, Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { MethodDot } from '@/components/MethodDot';
import { StatusBadge } from '@/components/StatusBadge';
import { Text } from '@/components/Text';
import { methods } from '@/data/methods';
import { useStore, useTenantSummaries } from '@/data/store';
import { formatAmount, formatDate, formatPeriod, formatPhone } from '@/lib/format';
import { callPhone, openWhatsApp } from '@/lib/whatsapp';
import { space, useTheme } from '@/theme';

function Fact({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: space.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
        gap: space.sm,
      }}>
      <Text tone="muted">{label}</Text>
      {children}
    </View>
  );
}

export default function LocataireDetail() {
  const { c, status } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { payments, period } = useStore();
  const summary = useTenantSummaries().find((s) => s.tenant.id === id);

  if (!summary) {
    return <EmptyState icon={Phone} title="Locataire introuvable" body="Ce locataire a peut-être été supprimé." />;
  }

  const { tenant, unit, property } = summary;
  const history = payments.filter((p) => p.tenantId === tenant.id);
  const remaining = Math.max(summary.due - summary.paid, 0);
  const reminder =
    `Bonjour ${tenant.firstName}, le loyer de ${formatPeriod(period)} (${formatAmount(summary.due)}) ` +
    (remaining < summary.due ? `est payé en partie : il reste ${formatAmount(remaining)}. ` : `était attendu le ${formatDate(summary.dueDate)}. `) +
    `Merci de régulariser dès que possible. Kaza`;

  return (
    <>
      <Stack.Screen options={{ title: `${tenant.firstName} ${tenant.lastName}` }} />
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar first={tenant.firstName} last={tenant.lastName} size={60} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="h2">
              {tenant.firstName} {tenant.lastName}
            </Text>
            <Text variant="small" tone="muted">
              {unit.label} · {property.name}
            </Text>
            <StatusBadge status={summary.status} style={{ alignSelf: 'flex-start' }} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <Button label="Appeler" icon={Phone} variant="secondary" style={{ flex: 1 }} onPress={() => callPhone(tenant.phone)} />
          <Button
            label={summary.status === 'paid' ? 'WhatsApp' : 'Relancer'}
            icon={MessageCircle}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => openWhatsApp(tenant.phone, summary.status === 'paid' ? `Bonjour ${tenant.firstName}, ` : reminder)}
          />
        </View>
        {summary.status !== 'paid' ? (
          <Button
            label={`Encaisser ${formatAmount(remaining)}`}
            icon={Plus}
            onPress={() => router.push({ pathname: '/encaisser', params: { tenantId: tenant.id } })}
          />
        ) : null}

        <Card style={{ paddingVertical: space.xxs }}>
          <Fact label="Loyer mensuel" first>
            <Amount value={summary.due} />
          </Fact>
          <Fact label={`Payé en ${formatPeriod(period).split(' ')[0]}`}>
            <Amount value={summary.paid} />
          </Fact>
          {remaining > 0 ? (
            <Fact label="Reste dû">
              <Amount value={remaining} color={status.late.fg} />
            </Fact>
          ) : null}
          <Fact label="Échéance">
            <Text variant="bodyStrong">le {tenant.dueDay} du mois</Text>
          </Fact>
          <Fact label="Avance restante">
            <Text variant="bodyStrong">{tenant.advanceMonthsLeft ? `${tenant.advanceMonthsLeft} mois` : 'Aucune'}</Text>
          </Fact>
          <Fact label="Téléphone">
            <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
              {formatPhone(tenant.phone)}
            </Text>
          </Fact>
        </Card>

        <Text variant="h3" accessibilityRole="header">
          Historique
        </Text>
        <Card padded={false}>
          {history.map((p, i) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                minHeight: 56,
                paddingHorizontal: space.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}>
              <MethodDot method={p.method} size={10} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={{ textTransform: 'capitalize' }}>
                  {formatPeriod(p.period)}
                </Text>
                <Text variant="small" tone="muted">
                  {formatDate(p.date)} · {methods[p.method].label}
                </Text>
              </View>
              <Amount value={p.amount} currency={false} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </>
  );
}
