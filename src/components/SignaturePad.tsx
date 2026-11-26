import { Eraser } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** Repère du tracé (le même que le PDF) : la signature garde ses proportions quelle que soit la largeur de l'écran */
const W = 320;
const H = 140;

/**
 * Signature au doigt : le tracé est gardé en « path » SVG (quelques kilo-octets), imprimé tel quel dans le PDF et
 * envoyé avec l'état des lieux, même sans réseau.
 */
export function SignaturePad({ label, value, onChange }: { label: string; value: string | null; onChange: (path: string | null) => void }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(W);
  const [path, setPath] = useState(value ?? '');
  const widthRef = useRef(W);
  const pathRef = useRef(path);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const draw = (next: string) => {
    pathRef.current = next;
    setPath(next);
  };
  const point = (x: number, y: number) => {
    const scale = W / widthRef.current;
    return `${Math.round(Math.min(Math.max(x * scale, 0), W))} ${Math.round(Math.min(Math.max(y * scale, 0), H))}`;
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => draw(`${pathRef.current} M${point(e.nativeEvent.locationX, e.nativeEvent.locationY)}`.trim()),
      onPanResponderMove: (e) => draw(`${pathRef.current} L${point(e.nativeEvent.locationX, e.nativeEvent.locationY)}`),
      onPanResponderRelease: () => onChangeRef.current(pathRef.current || null),
    }),
  ).current;

  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="bodyStrong">{label}</Text>
        {path ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Effacer la signature : ${label}`}
            hitSlop={10}
            onPress={() => {
              draw('');
              onChange(null);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Eraser size={16} color={c.textMuted} />
            <Text variant="small" tone="muted">
              Effacer
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View
        accessibilityLabel={`Zone de signature : ${label}`}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width || W;
          setWidth(widthRef.current);
        }}
        {...responder.panHandlers}
        style={{
          height: (H * width) / W,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: c.border,
          borderRadius: radius.md,
          backgroundColor: c.surface,
          overflow: 'hidden',
        }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} pointerEvents="none">
          {path ? <Path d={path} stroke={c.text} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
        {!path ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="small" tone="muted">
              Signez ici avec le doigt
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
