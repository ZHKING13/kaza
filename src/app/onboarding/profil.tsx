import { router, Stack } from 'expo-router';
import { ArrowRight, Phone, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { PhoneField } from '@/components/PhoneField';
import { TextField } from '@/components/TextField';
import { countries, splitPhone } from '@/data/countries';
import { useStore } from '@/data/store';
import { formatPhone } from '@/lib/format';
import { space, useTheme } from '@/theme';

export default function OnboardingProfil() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, session, setProfile } = useStore();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const initial = splitPhone(profile.phone || '', countries[0]);
  const [country, setCountry] = useState(initial.country);
  const [national, setNational] = useState(initial.national);
  const [submitted, setSubmitted] = useState(false);

  // Connexion par téléphone : numéro déjà vérifié, pas besoin de le redemander
  const phoneKnown = session?.provider === 'phone' && !!profile.phone;
  const digits = national.replace(/\D/g, '');
  const errors = {
    firstName: !firstName.trim() ? 'Indiquez votre prénom.' : undefined,
    lastName: !lastName.trim() ? 'Indiquez votre nom.' : undefined,
    phone: !phoneKnown && digits.length !== country.length ? `Indiquez un numéro de ${country.length} chiffres.` : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (e?: string) => (submitted ? e : undefined);

  const next = () => {
    setSubmitted(true);
    if (!valid) return;
    setProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phoneKnown ? profile.phone : `+${country.dial}${digits}`,
    });
    router.push('/onboarding/premier-bien');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled">
        <StepHeader
          step={1}
          total={2}
          title="Votre profil"
          body="Votre nom figure sur les quittances envoyées à vos locataires."
        />
        <TextField
          label="Prénom"
          icon={UserRound}
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          autoComplete="given-name"
          placeholder="Ex. Kouassi"
          error={show(errors.firstName)}
        />
        <TextField
          label="Nom"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          autoComplete="family-name"
          placeholder="Ex. Brou"
          error={show(errors.lastName)}
        />
        {phoneKnown ? (
          <TextField
            label="Téléphone"
            icon={Phone}
            value={formatPhone(profile.phone)}
            editable={false}
            helper="Vérifié par code."
          />
        ) : (
          <PhoneField
            label="Numéro WhatsApp"
            country={country}
            national={national}
            onChange={(ct, n) => {
              setCountry(ct);
              setNational(n);
            }}
            helper="Affiché sur les quittances, pour que vos locataires puissent vous joindre."
            error={show(errors.phone)}
          />
        )}
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: space.md,
          paddingBottom: insets.bottom + space.sm,
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}>
        <Button label="Continuer" icon={ArrowRight} onPress={next} />
      </View>
    </KeyboardAvoidingView>
  );
}
