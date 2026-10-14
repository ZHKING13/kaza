import { useState } from 'react';
import { View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { FormError } from './FormError';
import { Text } from './Text';
import { roleLabels, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { space } from '@/theme';

/** Invitations reçues sur le numéro du compte : rejoindre l'espace ou refuser. */
export function ReceivedInvitations({ onAccepted }: { onAccepted?: () => void }) {
  const { invitations, acceptInvitation, declineInvitation } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const run = async (id: string, action: () => Promise<void>, after?: () => void) => {
    setBusy(id);
    setError(undefined);
    try {
      await action();
      after?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      {invitations.map((inv) => (
        <Card key={inv.id} style={{ gap: space.sm }}>
          <View style={{ gap: 2 }}>
            <Text variant="h3">{inv.organization.name}</Text>
            <Text variant="small" tone="muted">
              {inv.invitedBy ? `${inv.invitedBy.name} vous invite` : 'Vous êtes invité'} comme {roleLabels[inv.role].toLowerCase()}. Valable
              jusqu’au {formatDate(inv.expiresAt)}.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <Button
              label="Refuser"
              variant="secondary"
              style={{ flex: 1 }}
              disabled={busy !== null}
              onPress={() => run(inv.id, () => declineInvitation(inv.id))}
            />
            <Button
              label={busy === inv.id ? 'Un instant…' : 'Rejoindre'}
              style={{ flex: 1 }}
              disabled={busy !== null}
              onPress={() => run(inv.id, () => acceptInvitation(inv.id), onAccepted)}
            />
          </View>
        </Card>
      ))}
      <FormError message={error} />
    </View>
  );
}
