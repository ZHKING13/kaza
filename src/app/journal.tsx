import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/FormError';
import { Text } from '@/components/Text';
import { methods } from '@/data/methods';
import { type ActivityEntry, remote, type Role } from '@/data/remote';
import { roleLabels, useStore } from '@/data/store';
import type { PaymentMethod } from '@/data/types';
import { errorMessage } from '@/lib/api';
import { formatAmount, formatPeriod } from '@/lib/format';
import { space, useTheme } from '@/theme';

const role = (r: unknown) => (typeof r === 'string' && r in roleLabels ? roleLabels[r as Role].toLowerCase() : '');

/** « Koffi Blé a encaissé 40 000 FCFA — Ali Sanogo, octobre 2026 » */
export function describeActivity(e: ActivityEntry): string {
  const d = e.data ?? {};
  const who = e.actor?.name ?? 'Quelqu’un';
  const subject = e.subject ?? '';
  const amount = typeof d.amount === 'number' ? formatAmount(d.amount) : '';
  const period = typeof d.period === 'string' ? formatPeriod(d.period) : '';
  switch (e.action) {
    case 'payment.created': {
      const method = typeof d.method === 'string' && d.method in methods ? ` (${methods[d.method as PaymentMethod].label})` : '';
      return `${who} a encaissé ${amount}${method} — ${subject}, ${period}`;
    }
    case 'payment.received': {
      const method = typeof d.method === 'string' && d.method in methods ? ` par ${methods[d.method as PaymentMethod].label}` : '';
      return `${subject} a payé ${amount} en ligne${method} — ${period}`;
    }
    case 'payment_request.created':
      return `${who} a envoyé un lien de paiement de ${amount} — ${subject}, ${period}`;
    case 'payment_request.cancelled':
      return `${who} a annulé un lien de paiement de ${amount} — ${subject}, ${period}`;
    case 'payment.voided':
      return `${who} a annulé un paiement de ${amount} — ${subject}, ${period}${typeof d.reason === 'string' ? ` (« ${d.reason} »)` : ''}`;
    case 'lease.created':
      return `${who} a ajouté le locataire ${subject}`;
    case 'lease.ended':
      return `${who} a enregistré le départ de ${subject}`;
    case 'invitation.created':
      return `${who} a invité le ${subject} comme ${role(d.role)}`;
    case 'invitation.revoked':
      return `${who} a annulé l’invitation du ${subject}`;
    case 'invitation.declined':
      return `${who} a refusé l’invitation`;
    case 'member.joined':
      return `${subject} a rejoint l’espace comme ${role(d.role)}`;
    case 'member.role_changed':
      return `${who} a fait passer ${subject} de ${role(d.from)} à ${role(d.to)}`;
    case 'member.removed':
      return `${who} a retiré ${subject} de l’espace`;
    case 'member.left':
      return `${subject} a quitté l’espace`;
    default:
      return `${who} : ${e.action}`;
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Qui a fait quoi dans l'espace (propriétaire, gérant). */
export default function Journal() {
  const { c } = useTheme();
  const { organizationId } = useStore();
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (next?: string) => {
      if (!organizationId) return;
      try {
        const page = await remote.activity(organizationId, next);
        setItems((prev) => (next ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setError(undefined);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoaded(true);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: 'Journal d’activité' }} />
      <Text variant="small" tone="muted">
        Chaque encaissement, annulation, entrée, départ et changement d’équipe, avec son auteur. Rien ne peut en être effacé.
      </Text>
      {loaded && items.length === 0 && !error ? (
        <Text variant="small" tone="muted">
          Rien pour l’instant.
        </Text>
      ) : null}
      {items.length > 0 ? (
        <Card padded={false}>
          {items.map((e, i) => (
            <View key={e.id} style={{ padding: space.md, gap: 2, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border }}>
              <Text variant="body">{describeActivity(e)}</Text>
              <Text variant="caption" tone="muted">
                {when(e.createdAt)}
                {e.actor?.role ? ` · ${roleLabels[e.actor.role]}` : ''}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      {cursor ? <Button label="Voir plus" variant="secondary" onPress={() => load(cursor)} /> : null}
      <FormError message={error} />
    </ScrollView>
  );
}
