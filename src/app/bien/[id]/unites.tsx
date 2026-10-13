import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { errorMessage } from '@/lib/api';
import { Text } from '@/components/Text';
import { draftKey, type UnitDraft, UnitsEditor } from '@/components/UnitsEditor';
import { useStore } from '@/data/store';
import { nextUnitLabel } from '@/lib/units';
import { space, useTheme } from '@/theme';

/** Ajoute des unités à un bien existant, en partant de la dernière unité saisie. */
export default function AjouterUnites() {
  const { c, status } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { properties, units: allUnits, addUnits } = useStore();
  const property = properties.find((p) => p.id === id);
  const existing = allUnits.filter((u) => u.propertyId === id);
  const last = existing[existing.length - 1];

  const [units, setUnits] = useState<UnitDraft[]>([
    { key: draftKey(), label: last ? nextUnitLabel(last.label) : '', rent: last?.rent ?? 0 },
  ]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const invalid = units.some((u) => !u.label.trim() || u.rent <= 0);

  const save = async () => {
    setSubmitted(true);
    if (invalid || !property || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await addUnits(property.id, units);
      router.back();
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Ajouter des unités' }} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">
          {property?.name} compte déjà {existing.length} unité{existing.length > 1 ? 's' : ''}
          {last ? `, la dernière est « ${last.label} »` : ''}.
        </Text>
        <UnitsEditor value={units} onChange={setUnits} />
        {submitted && invalid ? (
          <Text variant="small" color={status.late.fg}>
            Chaque unité doit avoir un nom et un loyer.
          </Text>
        ) : null}
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}>
        <FormError message={saveError} />
        <Button
          label={saving ? 'Enregistrement…' : `Ajouter ${units.length} unité${units.length > 1 ? 's' : ''}`}
          icon={Check}
          onPress={save}
          disabled={saving}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
