import { router, Stack } from 'expo-router';
import { MessageCircle, MessageSquare, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { AppleLogo, GoogleLogo } from '@/components/BrandLogos';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DemoBanner } from '@/components/DemoBanner';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { countries, type Country, groupDigits, splitPhone } from '@/data/countries';
import { useStore } from '@/data/store';
import { auth, type OtpChannel, type SocialIdentity } from '@/lib/auth';
import { fonts, radius, space, useTheme } from '@/theme';

function SocialButton({
  label,
  logo,
  dark,
  onPress,
  disabled,
}: {
  label: string;
  logo: React.ReactNode;
  dark?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c, scheme } = useTheme();
  // Bouton Apple : noir en clair, blanc en sombre (règles d'Apple)
  const bg = dark ? (scheme === 'dark' ? '#FFFFFF' : '#000000') : c.surface;
  const fg = dark ? (scheme === 'dark' ? '#000000' : '#FFFFFF') : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: dark ? bg : c.border,
        backgroundColor: bg,
        opacity: pressed || disabled ? 0.7 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
      })}>
      {logo}
      <Text variant="bodyStrong" color={fg}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Connexion() {
  const { c, status, scheme } = useTheme();
  const { signIn } = useStore();
  const [country, setCountry] = useState<Country>(countries[0]);
  const [national, setNational] = useState('');
  const [busy, setBusy] = useState<OtpChannel | 'google' | 'apple' | null>(null);
  const [error, setError] = useState<string>();

  const digits = national.replace(/\D/g, '');
  const phoneOk = digits.length === country.length;

  const sendCode = async (channel: OtpChannel) => {
    if (!phoneOk) {
      setError(
        digits
          ? `Un numéro en ${country.name} compte ${country.length} chiffres (${digits.length} saisis).`
          : 'Indiquez votre numéro de téléphone.',
      );
      return;
    }
    setError(undefined);
    setBusy(channel);
    try {
      const phone = `+${country.dial}${digits}`;
      const req = await auth.sendOtp(phone, channel);
      router.push({ pathname: '/verification', params: { phone, channel, demoCode: req.demoCode ?? '' } });
    } catch {
      setError('Le code n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(null);
    }
  };

  const social = async (provider: 'google' | 'apple') => {
    setError(undefined);
    setBusy(provider);
    try {
      const id: SocialIdentity = provider === 'google' ? await auth.signInWithGoogle() : await auth.signInWithApple();
      signIn({ provider, email: id.email }, { firstName: id.firstName ?? '', lastName: id.lastName ?? '' });
    } catch {
      setError(`La connexion avec ${provider === 'google' ? 'Google' : 'Apple'} a échoué. Réessayez ou utilisez votre numéro.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text variant="h1" accessibilityRole="header">
            Connexion
          </Text>
          <Text tone="muted">Entrez votre numéro : nous vous envoyons un code à 6 chiffres.</Text>
        </View>
        {auth.isDemo ? (
          <DemoBanner>Mode démo : aucun message n’est envoyé. Le code s’affichera à l’écran suivant.</DemoBanner>
        ) : null}

        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {countries.map((x) => (
              <Chip
                key={x.code}
                label={`${x.code} +${x.dial}`}
                selected={x.code === country.code}
                onPress={() => setCountry(x)}
              />
            ))}
          </View>
          <TextField
            label="Numéro de téléphone"
            icon={Phone}
            prefix={`+${country.dial}`}
            value={groupDigits(digits, country.groups)}
            onChangeText={(t) => {
              const s = splitPhone(t, country);
              setCountry(s.country);
              setNational(s.national.slice(0, 12));
              setError(undefined);
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder={`${country.length} chiffres`}
            style={{ fontVariant: ['tabular-nums'] }}
          />
          {error ? (
            <Text variant="small" color={status.late.fg}>
              {error}
            </Text>
          ) : null}
          <Button
            label={busy === 'whatsapp' ? 'Envoi…' : 'Recevoir le code par WhatsApp'}
            icon={MessageCircle}
            disabled={!!busy}
            onPress={() => sendCode('whatsapp')}
          />
          <Button
            label={busy === 'sms' ? 'Envoi…' : 'Recevoir le code par SMS'}
            icon={MessageSquare}
            variant="secondary"
            disabled={!!busy}
            onPress={() => sendCode('sms')}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          <Text variant="small" tone="muted">
            ou
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        </View>

        <View style={{ gap: space.sm }}>
          <SocialButton
            label={busy === 'google' ? 'Connexion…' : 'Continuer avec Google'}
            logo={<GoogleLogo />}
            disabled={!!busy}
            onPress={() => social('google')}
          />
          <SocialButton
            label={busy === 'apple' ? 'Connexion…' : 'Continuer avec Apple'}
            logo={<AppleLogo color={scheme === 'dark' ? '#000000' : '#FFFFFF'} size={18} />}
            dark
            disabled={!!busy}
            onPress={() => social('apple')}
          />
        </View>

        <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          En continuant, vous acceptez les conditions d’utilisation et la politique de confidentialité de Kaza.
        </Text>
        <Text variant="caption" tone="muted" style={{ textAlign: 'center', fontFamily: fonts.medium }}>
          Vos données restent sur ce téléphone tant que la synchronisation n’est pas activée.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
