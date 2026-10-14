import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { propertyTypes } from '@/data/propertyTypes';
import type { Property } from '@/data/types';
import { useTheme } from '@/theme';

type Props = {
  property: Pick<Property, 'type' | 'photo'>;
  height: number;
  /** Assombrit le bas de l'image pour que le texte posé dessus reste lisible */
  scrim?: boolean;
  children?: ReactNode;
};

/** Photo du bien si elle existe, sinon une illustration légère selon le type de bien. */
export function PropertyCover({ property, height, scrim, children }: Props) {
  const { c, scheme } = useTheme();
  const Icon = propertyTypes[property.type].icon;
  return (
    <View style={{ height, backgroundColor: c.primarySoft, overflow: 'hidden' }}>
      {property.photo ? (
        <Image source={{ uri: property.photo }} style={{ position: 'absolute', inset: 0 }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <Icon size={height * 0.9} color={c.primary} strokeWidth={1} style={{ opacity: scheme === 'dark' ? 0.35 : 0.18, marginRight: -height * 0.12, marginBottom: -height * 0.12 }} />
        </View>
      )}
      {scrim ? (
        <Svg style={{ position: 'absolute', inset: 0 }} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.35" stopColor="#0F172A" stopOpacity={0} />
              <Stop offset="1" stopColor="#0F172A" stopOpacity={property.photo ? 0.75 : 0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
