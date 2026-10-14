import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { ReceivedInvitations } from '@/components/ReceivedInvitations';
import { Text } from '@/components/Text';
import { space, useTheme } from '@/theme';

/**
 * Onboarding d'une personne invitée : rejoindre l'espace qui l'a invitée, ou créer le sien.
 * Rejoindre termine l'onboarding (les données de l'espace sont chargées).
 */
export default function OnboardingInvitation() {
  const { c } = useTheme();

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: 4 }}>
        <Text variant="h2" accessibilityRole="header">
          On vous attend
        </Text>
        <Text variant="body" tone="muted">
          Un espace Kaza vous a invité sur ce numéro.
        </Text>
      </View>
      <ReceivedInvitations />
      <Button label="Créer mon propre espace" variant="secondary" onPress={() => router.push('/onboarding/premier-bien')} />
    </ScrollView>
  );
}
