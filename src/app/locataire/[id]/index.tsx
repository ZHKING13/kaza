import { router, Stack, useLocalSearchParams } from 'expo-router';
import { DoorOpen, FileText, LogOut, MessageCircle, Phone, Plus } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { KazaMessages } from '@/components/KazaMessages';
import { LeaseEndBanner, LeaseTerms } from '@/components/LeaseTerms';
import { OnlinePayment } from '@/components/OnlinePayment';
import { MethodDot } from '@/components/MethodDot';
import { PdfButton } from '@/components/PdfButton';
import { SettlementSummary } from '@/components/SettlementSummary';
import { useSettlementDoc } from '@/data/documents';
import { StatusBadge } from '@/components/StatusBadge';
import { Text } from '@/components/Text';
import { byMethod, methods } from '@/data/methods';
import { useFormerTenants, usePermissions, useStore, useTenantSummaries } from '@/data/store';
import type { Payment } from '@/data/types';
import { formatAmount, formatDate, formatPeriod, formatPhone } from '@/lib/format';
import { callPhone, openWhatsApp } from '@/lib/whatsapp';
import { radius, space, useTheme } from '@/theme';

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

function History({ items }: { items: Payment[] }) {
  const { c } = useTheme();
  return (
    <>
      <Text variant="h3" accessibilityRole="header">
        Historique
      </Text>
      <Card padded={false}>
        {items.length === 0 ? (
          <EmptyState icon={DoorOpen} title="Aucun paiement" body="Les loyers reçus apparaîtront ici." />
        ) : (
          items.map((p, i) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityHint="Ouvre la quittance"
              onPress={() => router.push({ pathname: '/quittance/[id]', params: { id: p.id } })}
              style={({ pressed }) => ({
                backgroundColor: pressed ? c.surfaceAlt : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                minHeight: 56,
                paddingHorizontal: space.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              })}>
              <MethodDot method={p.method} size={10} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={{ textTransform: 'capitalize' }}>
                  {formatPeriod(p.period)}
                </Text>
                <Text variant="small" tone="muted">
                  {formatDate(p.date)} · {methods[p.method].label}
                  {p.online ? ' · payé en ligne' : ''}
                </Text>
              </View>
              <Amount value={p.amount} currency={false} />
              <FileText size={18} color={c.textMuted} />
            </Pressable>
          ))
        )}
      </Card>
    </>
  );
}

export default function LocataireDetail() {
  const { c, status } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { payments, period, organizationId } = useStore();
  const { canManage, canCollect } = usePermissions();
  const summary = useTenantSummaries().find((s) => s.tenant.id === id);
  const former = useFormerTenants().find((f) => f.tenant.id === id);
  const settlementDoc = useSettlementDoc(id);

  const historyOf = (tenantId: string) =>
    payments
      .filter((p) => p.tenantId === tenantId)
      .sort((a, b) => b.period.localeCompare(a.period) || b.date.localeCompare(a.date));

  // Ancien locataire : fiche en lecture seule avec le solde de tout compte
  if (!summary && former) {
    const { tenant, unit, property } = former;
    const s = tenant.settlement;
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
                Ancien locataire · {unit.label} · {property.name}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.sm }}>
            <LogOut size={18} color={c.textMuted} />
            <Text variant="small" tone="muted" style={{ flex: 1 }}>
              {tenant.entryDate ? `Entré le ${formatDate(tenant.entryDate)}, parti` : 'Parti'} le {formatDate(tenant.exitDate!)}
            </Text>
          </View>
          <Button label="Appeler" icon={Phone} variant="secondary" onPress={() => callPhone(tenant.phone)} />
          {s ? (
            <>
              <Text variant="h3" accessibilityRole="header">
                Solde de tout compte
              </Text>
              <SettlementSummary s={s} />
              {settlementDoc ? <PdfButton label="Partager le solde (PDF)" html={settlementDoc.html} fileName={settlementDoc.fileName} /> : null}
              {s.balance > 0 && s.refundMethod ? (
                <Text variant="small" tone="muted">
                  Remboursé {byMethod(s.refundMethod)}.
                </Text>
              ) : null}
            </>
          ) : null}
          <KazaMessages leaseId={tenant.id} organizationId={organizationId} canRemind={false} />
          <History items={historyOf(tenant.id)} />
        </ScrollView>
      </>
    );
  }

  if (!summary) {
    return <EmptyState icon={Phone} title="Locataire introuvable" body="Ce locataire a peut-être été supprimé." />;
  }

  const { tenant, unit, property } = summary;
  const remaining = Math.max(summary.due - summary.paid, 0);
  const reminder =
    `Bonjour ${tenant.firstName}, le loyer de ${formatPeriod(period)} (${formatAmount(summary.due)}) ` +
    (summary.paid > 0 ? `est payé en partie : il reste ${formatAmount(remaining)}. ` : `était attendu le ${formatDate(summary.dueDate)}. `) +
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
        <LeaseEndBanner tenant={tenant} />

        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <Button label="Appeler" icon={Phone} variant="secondary" style={{ flex: 1 }} onPress={() => callPhone(tenant.phone)} />
          <Button
            label={summary.status === 'late' || summary.status === 'partial' ? 'Relancer' : 'WhatsApp'}
            icon={MessageCircle}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() =>
              openWhatsApp(tenant.phone, summary.status === 'late' || summary.status === 'partial' ? reminder : `Bonjour ${tenant.firstName}, `)
            }
          />
        </View>
        {remaining > 0 && canCollect ? (
          <Button
            label={`Encaisser ${formatAmount(remaining)}`}
            icon={Plus}
            onPress={() => router.push({ pathname: '/encaisser', params: { tenantId: tenant.id } })}
          />
        ) : null}

        <Card style={{ paddingVertical: space.xxs }}>
          <Fact label="Loyer mensuel" first>
            <Amount value={summary.rent} />
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
          <Fact label="Avance à l’entrée">
            <Text variant="bodyStrong">{tenant.advanceMonthsLeft ? `${tenant.advanceMonthsLeft} mois` : 'Aucune'}</Text>
          </Fact>
          <Fact label="Caution">
            <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
              {tenant.depositMonths ? `${tenant.depositMonths} mois · ${formatAmount(tenant.depositMonths * (tenant.rent ?? unit.rent))}` : 'Aucune'}
            </Text>
          </Fact>
          {tenant.entryDate ? (
            <Fact label="Entrée">
              <Text variant="bodyStrong">{formatDate(tenant.entryDate)}</Text>
            </Fact>
          ) : null}
          <Fact label="Téléphone">
            <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
              {formatPhone(tenant.phone)}
            </Text>
          </Fact>
        </Card>

        <LeaseTerms tenant={tenant} unit={unit} canManage={canManage} />

        <OnlinePayment leaseId={tenant.id} remaining={remaining} canSend={canCollect} />

        <KazaMessages leaseId={tenant.id} organizationId={organizationId} canRemind={remaining > 0 && canCollect} />

        <History items={historyOf(tenant.id)} />

        {canManage ? (
          <Button
            label="Enregistrer le départ"
            icon={LogOut}
            variant="danger"
            onPress={() => router.push({ pathname: '/locataire/[id]/depart', params: { id: tenant.id } })}
          />
        ) : null}
      </ScrollView>
    </>
  );
}
