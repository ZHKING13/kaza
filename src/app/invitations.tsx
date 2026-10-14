import { router, Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ReceivedInvitations } from '@/components/ReceivedInvitations';
import { Text } from '@/components/Text';
import { useStore } from '@/data/store';
import { space, useTheme } from '@/theme';
import { MailOpen } from 'lucide-react-native';

/** Invitations reçues, depuis l'accueil ou l'onglet Plus. */
export default function Invitations() {
  const { c } = useTheme();
  const { invitations } = useStore();

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <Stack.Screen options={{ title: 'Invitations' }} />
      {invitations.length === 0 ? (
        <EmptyState icon={MailOpen} title="Aucune invitation" body="Les espaces qui vous invitent apparaîtront ici." />
      ) : (
        <>
          <Text variant="small" tone="muted">
            En rejoignant un espace, vous travaillez sur ses biens et locataires. Vous pourrez revenir au vôtre depuis l’onglet Plus.
          </Text>
          <ReceivedInvitations onAccepted={() => router.dismissTo('/')} />
        </>
      )}
    </ScrollView>
  );
}
