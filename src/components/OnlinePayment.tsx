import { Link2, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Share, View } from 'react-native';

import { Button } from './Button';
import { ConfirmSheet } from './ConfirmSheet';
import { Card } from './Card';
import { FormError } from './FormError';
import { Text } from './Text';
import { notifyMessagesChanged, useServerMessaging } from '@/data/messages';
import { type PaymentRequest, remote } from '@/data/remote';
import { useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatAmount, formatDate, formatPeriod } from '@/lib/format';
import { space, useTheme } from '@/theme';

const statusLabels: Record<PaymentRequest['status'], string> = {
  pending: 'En attente',
  paid: 'Payé',
  failed: 'Refusé',
  expired: 'Expiré',
  cancelled: 'Annulé',
};

/**
 * Fiche locataire, compte en ligne : lien de paiement mobile money (Wave, Orange Money, MTN, Moov)
 * envoyé sur le WhatsApp du locataire, ou partagé. Tant qu'un lien attend, la liste est relue
 * régulièrement ; un lien payé recharge les paiements de l'espace.
 */
export function OnlinePayment({ leaseId, remaining, canSend }: { leaseId: string; remaining: number; canSend: boolean }) {
  const { c, status } = useTheme();
  const { enabled, organizationId } = useServerMessaging();
  const { settings, refresh } = useStore();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<string>();
  const knownPaid = useRef<Set<string> | null>(null);
  // Relu à chaque rendu : la fonction du store change avec l'état, le chargement n'a pas à suivre
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const active = enabled && !!organizationId && !!settings.onlinePayments;

  const load = useCallback(async () => {
    if (!active) return;
    try {
      const list = await remote.paymentRequests(organizationId!, leaseId);
      setRequests(list);
      // Payé pendant que l'écran est ouvert : on recharge les paiements de l'espace
      const paid = new Set(list.filter((r) => r.status === 'paid').map((r) => r.id));
      if (knownPaid.current && [...paid].some((id) => !knownPaid.current!.has(id))) void refreshRef.current();
      knownPaid.current = paid;
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [active, organizationId, leaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPending = requests.some((r) => r.status === 'pending');
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, [hasPending, load]);

  if (!active) return null;

  const send = async () => {
    setSending(true);
    setError(undefined);
    try {
      const request = await remote.createPaymentRequest(organizationId!, leaseId, { send: true });
      setSent(request);
      notifyMessagesChanged();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const share = (r: PaymentRequest) =>
    Share.share({
      message: `Lien pour payer le loyer de ${formatPeriod(r.period)} (${formatAmount(r.amount)}) par Wave, Orange Money, MTN ou Moov : ${r.link}`,
    }).catch(() => {});

  const [cancelling, setCancelling] = useState<PaymentRequest | null>(null);
  const cancel = async (r: PaymentRequest) => {
    await remote.cancelPaymentRequest(organizationId!, r.id);
    if (sent?.id === r.id) setSent(null);
    await load();
  };

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="h3" accessibilityRole="header">
        Paiement en ligne
      </Text>
      {canSend && remaining > 0 ? (
        <Button
          label={sending ? 'Envoi…' : `Envoyer un lien de paiement (${formatAmount(remaining)})`}
          icon={Link2}
          variant="secondary"
          disabled={sending}
          onPress={send}
        />
      ) : null}
      {sent && requests.find((r) => r.id === sent.id)?.status !== 'paid' && requests.find((r) => r.id === sent.id)?.status !== 'cancelled' ? (
        <Card style={{ gap: space.xs, backgroundColor: c.primarySoft }}>
          <Text variant="small" tone="primary" accessibilityRole="alert">
            Lien envoyé sur le WhatsApp du locataire. Il peut payer par Wave, Orange Money, MTN ou Moov ; le paiement
            s’enregistre tout seul.
          </Text>
          <Text variant="caption" tone="muted" selectable>
            {sent.link}
          </Text>
          <Button label="Partager le lien" icon={Share2} variant="ghost" compact onPress={() => share(sent)} />
        </Card>
      ) : null}
      {requests.length > 0 ? (
        <Card padded={false}>
          {requests.slice(0, 5).map((r, i) => (
            <View
              key={r.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                padding: space.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">
                  {formatAmount(r.amount)} · {formatPeriod(r.period)}
                </Text>
                <Text variant="caption" tone="muted">
                  {r.status === 'paid' && r.paidAt
                    ? `Payé le ${formatDate(r.paidAt)}`
                    : r.status === 'pending'
                      ? `Valable jusqu’au ${formatDate(r.expiresAt)}`
                      : `Envoyé le ${formatDate(r.createdAt)}`}
                </Text>
              </View>
              {r.status === 'pending' && canSend ? (
                <Button label="Annuler" variant="ghost" compact onPress={() => setCancelling(r)} />
              ) : (
                <Text
                  variant="small"
                  color={r.status === 'paid' ? status.paid.fg : r.status === 'failed' ? status.late.fg : c.textMuted}>
                  {statusLabels[r.status]}
                </Text>
              )}
            </View>
          ))}
        </Card>
      ) : null}
      <FormError message={error} />
      <ConfirmSheet
        visible={!!cancelling}
        title="Annuler ce lien de paiement ?"
        message={
          cancelling
            ? `Le locataire ne pourra plus payer ${formatAmount(cancelling.amount)} (${formatPeriod(cancelling.period)}) avec ce lien. Un paiement déjà fait reste enregistré.`
            : undefined
        }
        confirmLabel="Annuler le lien"
        cancelLabel="Garder le lien"
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel(cancelling!)}
      />
    </View>
  );
}
