import { Check, ChevronDown, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countries, type Country, groupDigits, splitPhone } from '@/data/countries';
import { noWebOutline } from '@/lib/web';
import { fonts, radius, space, useTheme } from '@/theme';

import { Flag } from './Flag';
import { Text } from './Text';

type Props = {
  label: string;
  country: Country;
  /** Chiffres du numéro national, sans indicatif */
  national: string;
  onChange: (country: Country, national: string) => void;
  helper?: string;
  error?: string;
  autoFocus?: boolean;
};

/**
 * Champ téléphone avec le pays dans le champ : drapeau + indicatif à gauche, un tap ouvre la liste des pays.
 * Un numéro collé avec son indicatif (« +221 77… ») sélectionne le pays automatiquement.
 */
export function PhoneField({ label, country, national, onChange, helper, error, autoFocus }: Props) {
  const { c, status } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const digits = national.replace(/\D/g, '');

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          minHeight: 52,
          borderRadius: radius.sm,
          borderWidth: focused ? 2 : 1,
          borderColor: error ? status.late.fg : focused ? c.primary : c.border,
          backgroundColor: c.surface,
          overflow: 'hidden',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pays : ${country.name}, indicatif +${country.dial}. Changer de pays`}
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: space.sm,
            borderRightWidth: 1,
            borderRightColor: c.border,
            backgroundColor: pressed ? c.surfaceAlt : 'transparent',
          })}>
          <Flag code={country.code} size={24} />
          <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
            +{country.dial}
          </Text>
          <ChevronDown size={16} color={c.textMuted} />
        </Pressable>
        <TextInput
          value={groupDigits(digits, country.groups)}
          onChangeText={(t) => {
            const s = splitPhone(t, country);
            onChange(s.country, s.national.slice(0, 12));
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={groupDigits('0'.repeat(country.length), country.groups)}
          placeholderTextColor={c.textDisabled}
          accessibilityLabel={label}
          style={{
            flex: 1,
            minWidth: 0,
            paddingHorizontal: space.sm,
            fontFamily: fonts.regular,
            fontSize: 17,
            color: c.text,
            fontVariant: ['tabular-nums'],
            ...noWebOutline,
          }}
        />
      </View>
      {error ? (
        <Text variant="small" color={status.late.fg}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="small" tone="muted">
          {helper}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel="Fermer"
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            paddingBottom: insets.bottom + space.sm,
            maxHeight: '75%',
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: space.md,
              paddingBottom: space.xs,
            }}>
            <Text variant="h3" accessibilityRole="header">
              Pays du numéro
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer la liste des pays"
              onPress={() => setOpen(false)}
              hitSlop={8}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <X size={22} color={c.text} />
            </Pressable>
          </View>
          <ScrollView>
            {countries.map((x) => {
              const on = x.code === country.code;
              return (
                <Pressable
                  key={x.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${x.name}, +${x.dial}`}
                  onPress={() => {
                    onChange(x, digits);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    minHeight: 56,
                    paddingHorizontal: space.md,
                    backgroundColor: on ? c.primarySoft : pressed ? c.surfaceAlt : 'transparent',
                  })}>
                  <Flag code={x.code} size={28} />
                  <Text variant="body" style={{ flex: 1, fontFamily: on ? fonts.semibold : fonts.regular }}>
                    {x.name}
                  </Text>
                  <Text variant="body" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                    +{x.dial}
                  </Text>
                  <View style={{ width: 22, alignItems: 'flex-end' }}>{on ? <Check size={20} color={c.primary} /> : null}</View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
