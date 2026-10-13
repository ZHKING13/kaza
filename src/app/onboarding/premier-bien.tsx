import { Stack } from 'expo-router';
import { Pressable, View } from 'react-native';

import { PropertyForm } from '@/components/PropertyForm';
import { StepHeader } from '@/components/StepHeader';
import { Text } from '@/components/Text';
import { useStore } from '@/data/store';
import { fonts, space, useTheme } from '@/theme';

export default function OnboardingPremierBien() {
  const { c } = useTheme();
  const { completeOnboarding } = useStore();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={completeOnboarding}
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm }}>
              <Text variant="body" tone="primary" style={{ fontFamily: fonts.medium }}>
                Plus tard
              </Text>
            </Pressable>
          ),
        }}
      />
      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>
        <StepHeader
          step={2}
          total={2}
          title="Votre premier bien"
          body="Une cour, une villa, un immeuble… Vous ajouterez les locataires ensuite."
        />
      </View>
      <PropertyForm compact submitLabel="Enregistrer et commencer" onSaved={completeOnboarding} />
    </View>
  );
}
