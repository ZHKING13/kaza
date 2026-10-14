import { View } from 'react-native';

import { KazaSendButton } from './KazaSendButton';
import { TenantMessages } from './TenantMessages';
import { useTenantMessages } from '@/data/messages';
import { remote } from '@/data/remote';
import { space } from '@/theme';

/**
 * Fiche locataire, compte en ligne : relance envoyée par Kaza (WhatsApp, repli SMS) et messages
 * déjà envoyés. Rien en mode démo.
 */
export function KazaMessages({ leaseId, organizationId, canRemind }: { leaseId: string; organizationId: string | null; canRemind: boolean }) {
  const { enabled, messages, error, reload } = useTenantMessages(leaseId);
  if (!enabled || !organizationId) return null;

  return (
    <View style={{ gap: space.md }}>
      {canRemind ? (
        <KazaSendButton
          label="Envoyer une relance par Kaza"
          sentLabel="Relance envoyée sur le WhatsApp du locataire."
          send={() => remote.sendRentReminder(organizationId, leaseId)}
          onSent={() => setTimeout(() => void reload(), 1500)}
        />
      ) : null}
      <TenantMessages messages={messages} error={error} />
    </View>
  );
}
