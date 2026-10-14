import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { noWebOutline } from '@/lib/web';
import { fonts, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  helper?: string;
  error?: string;
  icon?: LucideIcon;
  /** Texte fixe à gauche du champ, ex. « +225 » */
  prefix?: string;
  /** Texte fixe à droite du champ, ex. « FCFA » */
  suffix?: string;
};

/** Champ avec libellé toujours visible au-dessus, aide ou erreur en dessous. */
export function TextField({ label, helper, error, icon: Icon, prefix, suffix, multiline, style, onFocus, onBlur, ...rest }: Props) {
  const { c, status } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" tone="text" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: space.xs,
          minHeight: multiline ? 96 : 48,
          paddingHorizontal: space.sm,
          borderRadius: radius.sm,
          borderWidth: focused ? 2 : 1,
          borderColor: error ? status.late.fg : focused ? c.primary : c.border,
          backgroundColor: c.surface,
        }}>
        {Icon ? <Icon size={20} color={c.textMuted} style={{ marginTop: multiline ? space.sm : 0 }} /> : null}
        {prefix ? (
          <Text variant="bodyStrong" tone="muted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.textMuted}
          multiline={multiline}
          style={[
            {
              flex: 1,
              minWidth: 0,
              fontFamily: fonts.regular,
              fontSize: 16,
              color: c.text,
              paddingVertical: space.sm,
              textAlignVertical: multiline ? 'top' : 'center',
              ...noWebOutline,
            },
            style,
          ]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {suffix ? (
          <Text variant="small" tone="muted">
            {suffix}
          </Text>
        ) : null}
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
    </View>
  );
}
