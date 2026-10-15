import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { PhoneField } from '@/components/PhoneField';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { type Country, countries, splitPhone } from '@/data/countries';
import { formatRate } from '@/data/expenses';
import { usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatAmount } from '@/lib/format';
import { space, useTheme } from '@/theme';

/** Bien géré pour un propriétaire (agence) : son nom, son numéro et la commission prélevée sur les loyers. */
export default function Mandant() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { properties, setLandlord } = useStore();
  const { canManage } = usePermissions();
  const property = properties.find((p) => p.id === id);
  const initial = property?.landlordPhone ? splitPhone(property.landlordPhone, countries[0]) : { country: countries[0], national: '' };

  const [name, setName] = useState(property?.landlordName ?? '');
  const [country, setCountry] = useState<Country>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [rate, setRate] = useState(property?.commissionBps ? String(property.commissionBps / 100).replace('.', ',') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (!property || !canManage) {
    return <EmptyState icon={UserRound} title="Modification impossible" body="Ce bien n’existe plus, ou votre rôle ne le permet pas." />;
  }

  const digits = national.replace(/\D/g, '');
  const percent = Number(rate.replace(',', '.'));
  const bps = rate.trim() ? Math.round(percent * 100) : 0;

  const save = async (clear = false) => {
    if (!clear) {
      if (digits && digits.length !== country.length) return setError(`Un numéro en ${country.name} compte ${country.length} chiffres.`);
      if (rate.trim() && (Number.isNaN(percent) || percent < 0 || percent > 50)) return setError('La commission va de 0 à 50 %.');
    }
    setSaving(true);
    setError(undefined);
    try {
      await setLandlord(
        property.id,
        clear
          ? {}
          : { landlordName: name.trim() || undefined, landlordPhone: digits ? `+${country.dial}${digits}` : undefined, commissionBps: bps || undefined },
      );
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Propriétaire du bien' }} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">
          Vous gérez « {property.name} » pour quelqu’un d’autre ? Son nom et sa commission servent au compte rendu de gestion
          (Plus › Rapports) : loyers encaissés, commission, dépenses et montant à lui reverser.
        </Text>
        <TextField label="Nom du propriétaire" value={name} onChangeText={setName} placeholder="Mme Aya Bamba" maxLength={120} />
        <PhoneField
          label="Son numéro (facultatif)"
          country={country}
          national={national}
          onChange={(ct, n) => {
            setCountry(ct);
            setNational(n);
          }}
          helper="Pour lui envoyer le compte rendu par WhatsApp."
        />
        <TextField
          label="Commission de gestion"
          keyboardType="decimal-pad"
          value={rate}
          onChangeText={(t) => setRate(t.replace(/[^\d,.]/g, ''))}
          suffix="%"
          placeholder="10"
          helper={
            bps > 0 && bps <= 5000
              ? `${formatRate(bps)} des loyers encaissés : ${formatAmount(Math.round((100000 * bps) / 10000))} sur 100 000 FCFA.`
              : 'Pourcentage prélevé sur les loyers encaissés.'
          }
        />
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          gap: space.xs,
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}>
        <FormError message={error} />
        <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} icon={Check} onPress={() => save()} disabled={saving} />
        {property.landlordName ? <Button label="Ce bien est à moi" variant="ghost" onPress={() => save(true)} disabled={saving} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}
