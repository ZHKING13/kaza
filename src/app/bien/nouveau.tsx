import { router, Stack } from 'expo-router';
import { X } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { PropertyForm } from '@/components/PropertyForm';
import { Text } from '@/components/Text';
import { fonts, space, useTheme } from '@/theme';

export default function NouveauBien() {
  const { c } = useTheme();
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Nouveau bien',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: space.sm }}>
              <X size={20} color={c.primary} />
              <Text variant="body" tone="primary" style={{ fontFamily: fonts.medium }}>
                Annuler
              </Text>
            </Pressable>
          ),
        }}
      />
      <PropertyForm onSaved={(id) => router.dismissTo({ pathname: '/bien/[id]', params: { id } })} />
    </>
  );
}
