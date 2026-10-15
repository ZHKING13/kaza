import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ban, FileText, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { ReceiptHeader, useReceiptBrand } from '@/components/ReceiptHeader';
import { KazaSendButton } from '@/components/KazaSendButton';
import { PdfButton } from '@/components/PdfButton';
import { useServerMessaging } from '@/data/messages';
import { remote } from '@/data/remote';
import { Text } from '@/components/Text';
import { useReceipt } from '@/data/documents';
import { usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
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

const VOID_REASONS = ['Erreur de saisie', 'Argent non reçu', 'Paiement en double'];

/** Annulation d'un paiement : le paiement n'est pas effacé, il sort des montants encaissés (motif gardé sur le serveur). */
function VoidPayment({ paymentId }: { paymentId: string }) {
  const { status } = useTheme();
  const { voidPayment } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(VOID_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (!open) {
    return <Button label="Annuler ce paiement" icon={Ban} variant="ghost" onPress={() => setOpen(true)} />;
  }

  const confirm = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await voidPayment(paymentId, reason);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: space.sm, borderColor: status.late.fg }}>
      <Text variant="bodyStrong">Annuler ce paiement ?</Text>
      <Text variant="small" tone="muted">
        Il ne comptera plus dans les loyers encaissés. L’annulation et son motif restent dans l’historique de votre compte.
      </Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {VOID_REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <FormError message={error} />
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        <Button label="Garder" variant="secondary" style={{ flex: 1 }} onPress={() => setOpen(false)} />
        <Button
          label={saving ? 'Annulation…' : 'Annuler le paiement'}
          variant="danger"
          style={{ flex: 1 }}
          disabled={saving}
          onPress={confirm}
        />
      </View>
    </Card>
  );
}

/** Aperçu de la quittance (ou du reçu partiel) d'un paiement, avec partage en PDF. */
export default function Quittance() {
  const { c, status } = useTheme();
  const { canManage } = usePermissions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useReceipt(id);
  const { color: brandSoft } = useReceiptBrand();

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
        <ReceiptHeader title={full ? 'Quittance de loyer' : 'Reçu de paiement partiel'} number={`N° ${receiptNumber(payment)}`} />
        <View
          style={{
            backgroundColor: brandSoft.soft,
            borderWidth: 1,
            borderColor: brandSoft.line,
            borderRadius: radius.md,
            padding: space.sm,
            gap: 2,
          }}>
          {/* Encadré clair, comme sur le papier : texte foncé même en mode sombre */}
          <Text variant="amountXL" color="#0F172A" style={{ fontSize: 26, lineHeight: 34 }}>
            {formatAmount(payment.amount)}
          </Text>
          <Text variant="small" color="#475569">
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
      <SendReceiptByKaza paymentId={payment.id} full={full} disabled={payment.method === 'caution'} />
      <PdfButton label={full ? 'Partager la quittance (PDF)' : 'Partager le reçu (PDF)'} html={r.html} fileName={r.fileName} variant="primary" />
      <Button label="Envoyer un message WhatsApp" icon={MessageCircle} variant="secondary" onPress={() => openWhatsApp(tenant.phone, text)} />
      {/* Les retenues sur caution font partie du solde de départ : pas d'annulation */}
      {canManage && payment.method !== 'caution' && !tenant.exitDate ? <VoidPayment paymentId={payment.id} /> : null}
    </ScrollView>
  );
}

/** Compte en ligne : Kaza envoie le PDF sur le WhatsApp du locataire (repli SMS, texte seul). */
function SendReceiptByKaza({ paymentId, full, disabled }: { paymentId: string; full: boolean; disabled: boolean }) {
  const { enabled, organizationId } = useServerMessaging();
  const { canCollect } = usePermissions();
  if (!enabled || !organizationId || disabled || !canCollect) return null;
  return (
    <KazaSendButton
      label={full ? 'Envoyer la quittance par Kaza' : 'Envoyer le reçu par Kaza'}
      sentLabel="Envoi en cours sur le WhatsApp du locataire."
      variant="primary"
      send={() => remote.sendReceipt(organizationId, paymentId)}
    />
  );
}
