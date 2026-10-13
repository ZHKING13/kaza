import { Stack, useLocalSearchParams } from 'expo-router';
import { FileText, MessageCircle } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { KazaMark } from '@/components/KazaMark';
import { PdfButton } from '@/components/PdfButton';
import { Text } from '@/components/Text';
import { useReceipt } from '@/data/documents';
import { methods } from '@/data/methods';
import { receiptNumber } from '@/lib/documents';
import { formatAmount, formatDate, formatPeriod } from '@/lib/format';
import { openWhatsApp } from '@/lib/whatsapp';
import { numberToWords } from '@/lib/words';
import { radius, space, useTheme } from '@/theme';

function Row({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, paddingVertical: space.xs, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <Text tone="muted">{label}</Text>
      <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

/** Aperçu de la quittance (ou du reçu partiel) d'un paiement, avec partage en PDF. */
export default function Quittance() {
  const { c, status } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useReceipt(id);

  if (!r) return <EmptyState icon={FileText} title="Paiement introuvable" body="Ce paiement a peut-être été annulé." />;

  const { payment, tenant, unit, property, full, paidForPeriod, dueForPeriod } = r;
  const period = formatPeriod(payment.period);
  const words = numberToWords(payment.amount);
  const text = full
    ? `Bonjour ${tenant.firstName}, nous confirmons la réception de ${formatAmount(payment.amount)} (${methods[payment.method].label}) pour le loyer de ${period}, ${unit.label} – ${property.name}. Votre quittance N° ${receiptNumber(payment)} suit en PDF. Merci ! Kaza`
    : `Bonjour ${tenant.firstName}, nous avons reçu ${formatAmount(payment.amount)} pour le loyer de ${period}. Il reste ${formatAmount(dueForPeriod - paidForPeriod)} à régler. Merci ! Kaza`;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: full ? 'Quittance' : 'Reçu partiel' }} />
      <Card style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
          <KazaMark size={28} />
          <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
            <Text variant="h3" tone="primary">
              {full ? 'Quittance de loyer' : 'Reçu de paiement partiel'}
            </Text>
            <Text variant="caption" tone="muted">
              N° {receiptNumber(payment)}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: c.primarySoft, borderRadius: radius.md, padding: space.sm, gap: 2 }}>
          <Text variant="amountXL" style={{ fontSize: 26, lineHeight: 34 }}>
            {formatAmount(payment.amount)}
          </Text>
          <Text variant="small" tone="muted">
            {words.charAt(0).toUpperCase() + words.slice(1)} francs CFA
          </Text>
        </View>
        <View>
          <Row label="Locataire" value={`${tenant.firstName} ${tenant.lastName}`} first />
          <Row label="Logement" value={`${unit.label} · ${property.name}`} />
          <Row label="Période" value={period.charAt(0).toUpperCase() + period.slice(1)} />
          <Row label="Mode" value={methods[payment.method].label} />
          <Row label="Payé le" value={formatDate(payment.date)} />
        </View>
        {!full ? (
          <Text variant="small" color={status.partial.fg}>
            Paiement partiel : il reste {formatAmount(dueForPeriod - paidForPeriod)} pour {period}. Une quittance ne se délivre que pour un loyer
            payé en entier, ce document est donc un reçu.
          </Text>
        ) : null}
      </Card>
      <PdfButton label={full ? 'Partager la quittance (PDF)' : 'Partager le reçu (PDF)'} html={r.html} fileName={r.fileName} variant="primary" />
      <Button label="Envoyer un message WhatsApp" icon={MessageCircle} variant="secondary" onPress={() => openWhatsApp(tenant.phone, text)} />
    </ScrollView>
  );
}
