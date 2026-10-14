import { Text as RNText, type TextProps } from 'react-native';

import { type, useTheme } from '@/theme';

type Variant = keyof typeof type;
type Tone = 'text' | 'muted' | 'primary' | 'onPrimary' | 'disabled';

export function Text({
  variant = 'body',
  tone = 'text',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone; color?: string }) {
  const { c } = useTheme();
  const toneColor = {
    text: c.text,
    muted: c.textMuted,
    primary: c.primary,
    onPrimary: c.onPrimary,
    disabled: c.textDisabled,
  }[tone];
  return <RNText maxFontSizeMultiplier={2} style={[type[variant], { color: color ?? toneColor }, style]} {...rest} />;
}
