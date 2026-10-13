import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { DemoBanner } from '@/components/DemoBanner';
import { Text } from '@/components/Text';
import { useStore } from '@/data/store';
import { auth, type OtpChannel } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';

const LENGTH = 6;

export default function Verification() {
  const { c, status } = useTheme();
  const params = useLocalSearchParams<{ phone: string; channel: OtpChannel; demoCode?: string }>();
  const { signIn } = useStore();
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState(params.demoCode);
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const verify = async (value: string) => {
    setChecking(true);
    setError(undefined);
    const ok = await auth.verifyOtp(params.phone, value);
    setChecking(false);
    if (ok) {
      signIn({ provider: 'phone', phone: params.phone }, { phone: params.phone });
    } else {
      setError('Code incorrect. Vérifiez les 6 chiffres et réessayez.');
      setCode('');
      input.current?.focus();
    }
  };

  const resend = async () => {
    const req = await auth.sendOtp(params.phone, params.channel);
    setDemoCode(req.demoCode);
    setResendIn(req.resendIn);
    setCode('');
    setError(undefined);
  };

  const via = params.channel === 'whatsapp' ? 'WhatsApp' : 'SMS';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: space.lg, gap: space.lg }}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: 4 }}>
        <Text variant="h1" accessibilityRole="header">
          Entrez le code
        </Text>
        <Text tone="muted">
          Envoyé par {via} au {formatPhone(params.phone)}.
        </Text>
      </View>
      {auth.isDemo && demoCode ? <DemoBanner>{`Mode démo : votre code est ${demoCode}.`}</DemoBanner> : null}

      <Pressable accessibilityRole="none" onPress={() => input.current?.focus()} style={{ flexDirection: 'row', gap: space.xs, justifyContent: 'center' }}>
        {Array.from({ length: LENGTH }, (_, i) => {
          const filled = i < code.length;
          const active = i === code.length && !checking;
          return (
            <View
              key={i}
              style={{
                width: 48,
                height: 56,
                borderRadius: radius.md,
                borderWidth: active ? 2 : 1,
                borderColor: error ? status.late.fg : active ? c.primary : c.border,
                backgroundColor: c.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text variant="h2" style={{ fontVariant: ['tabular-nums'] }}>
                {filled ? code[i] : ''}
              </Text>
            </View>
          );
        })}
      </Pressable>
      {/* Champ réel, invisible : gère le clavier, le collage et le remplissage automatique du code */}
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, LENGTH);
          setCode(v);
          if (v.length === LENGTH) verify(v);
        }}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        accessibilityLabel="Code à 6 chiffres"
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />

      {error ? (
        <Text variant="small" color={status.late.fg} style={{ textAlign: 'center' }}>
          {error}
        </Text>
      ) : checking ? (
        <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
          Vérification…
        </Text>
      ) : null}

      <View style={{ alignItems: 'center', gap: space.xs }}>
        {resendIn > 0 ? (
          <Text variant="small" tone="muted">
            Renvoyer le code dans {resendIn} s
          </Text>
        ) : (
          <Pressable accessibilityRole="button" onPress={resend} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text variant="body" tone="primary" style={{ fontFamily: fonts.semibold }}>
              Renvoyer le code
            </Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text variant="body" tone="primary" style={{ fontFamily: fonts.medium }}>
            Modifier le numéro
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
