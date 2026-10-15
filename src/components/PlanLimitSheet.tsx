import { router } from 'expo-router';
import { Crown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Text } from './Text';
import { onPlanLimit, type PlanLimitError } from '@/lib/api';
import { radius, space, useTheme } from '@/theme';

/**
 * Quand le serveur refuse une action à cause de l'offre (logements, équipe, messages, liens de
 * paiement, quittances à vos couleurs, journal), propose de changer d'offre, où que l'on soit.
 */
export function PlanLimitSheet() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<PlanLimitError | null>(null);

  useEffect(() => onPlanLimit(setError), []);

  const close = () => setError(null);
  const suggested = error?.data?.suggestedPlanLabel;

  return (
    <Modal visible={!!error} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        accessibilityLabel="Fermer"
        onPress={close}
        style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: space.lg,
            paddingBottom: insets.bottom + space.lg,
            gap: space.md,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ backgroundColor: c.primarySoft, borderRadius: radius.full, padding: space.xs }}>
              <Crown size={22} color={c.accent} />
            </View>
            <Text variant="h3" accessibilityRole="header" style={{ flex: 1 }}>
              {suggested ? `Avec l’offre ${suggested}` : 'Changer d’offre'}
            </Text>
          </View>
          <Text>{error?.message}</Text>
          <Text variant="small" tone="muted">
            Vos données restent accessibles : vous pouvez toujours consulter, encaisser et imprimer vos quittances.
          </Text>
          <Button
            label="Voir les offres"
            icon={Crown}
            onPress={() => {
              close();
              router.push('/offre');
            }}
          />
          <Button label="Plus tard" variant="ghost" onPress={close} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
