import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, type PressableProps, View } from 'react-native';

import { radius, space, touch, useTheme } from '@/theme';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  icon?: LucideIcon;
  haptic?: boolean;
  compact?: boolean;
};

export function Button({ label, variant = 'primary', icon: Icon, haptic, compact, onPress, style, disabled, ...rest }: Props) {
  const { c, status } = useTheme();
  const colors = {
    primary: { bg: c.primary, pressed: c.primaryPressed, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surface, pressed: c.surfaceAlt, fg: c.primary, border: c.border },
    ghost: { bg: 'transparent', pressed: c.surfaceAlt, fg: c.primary, border: 'transparent' },
    danger: { bg: c.surface, pressed: status.late.bg, fg: status.late.fg, border: c.border },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      android_ripple={{ color: c.primarySoft }}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.(e);
      }}
      style={(state) => [
        {
          minHeight: compact ? 40 : touch.min,
          paddingHorizontal: compact ? space.sm : space.lg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: state.pressed ? colors.pressed : colors.bg,
          opacity: disabled ? 0.5 : 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {Icon ? <Icon size={20} color={colors.fg} strokeWidth={2} /> : null}
        <Text variant={compact ? 'small' : 'bodyStrong'} color={colors.fg} style={compact ? { fontFamily: 'IBMPlexSans_600SemiBold' } : undefined}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
