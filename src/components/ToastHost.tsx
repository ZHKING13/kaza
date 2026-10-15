import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { onToast, type Toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';

const DURATION = 5000;

/** Affiche les messages brefs en haut de l'écran, quelques secondes ; un appui les ferme. */
export function ToastHost() {
  const { c, status } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () =>
      onToast((t) => {
        clearTimeout(timer.current);
        setToast(t);
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
        timer.current = setTimeout(() => hide(), DURATION);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const hide = () => {
    clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => setToast(null));
  };

  if (!toast) return null;
  const tone = toast.tone === 'error' ? status.late : toast.tone === 'info' ? status.upcoming : status.paid;
  const Icon = toast.tone === 'error' ? CircleAlert : toast.tone === 'info' ? Info : CircleCheck;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + space.xs, left: space.md, right: space.md, opacity }}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={hide}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.md,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: tone.fg,
          shadowColor: '#0F172A',
          shadowOpacity: 0.15,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}>
        <Icon size={22} color={tone.fg} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
