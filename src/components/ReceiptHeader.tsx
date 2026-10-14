import { Image, View } from 'react-native';

import { KazaMark } from './KazaMark';
import { Text } from './Text';
import { brandColor } from '@/data/brand';
import { branding } from '@/lib/documents';
import { type Identity, useStore } from '@/data/store';
import { space } from '@/theme';

/** Identité imprimée (null : document Kaza par défaut), comme dans le PDF. */
export function useReceiptBrand(identity?: Identity) {
  const store = useStore();
  const brand = branding(identity ?? store.identity, store.profile);
  return { brand, color: brand?.color ?? brandColor('teal') };
}

/** En-tête de quittance : logo (ou raison sociale) à gauche, titre et numéro à droite. */
export function ReceiptHeader({ title, number, identity }: { title: string; number: string; identity?: Identity }) {
  const { brand, color } = useReceiptBrand(identity);
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: space.sm,
        borderBottomWidth: 2,
        borderBottomColor: color.main,
        paddingBottom: space.sm,
      }}>
      {!brand ? (
        <KazaMark size={28} />
      ) : brand.logo ? (
        <Image
          source={{ uri: brand.logo }}
          style={{ width: 110, height: 40 }}
          resizeMode="contain"
          accessibilityLabel={`Logo ${brand.name}`}
        />
      ) : (
        <Text variant="bodyStrong" color={color.main} style={{ flexShrink: 1, maxWidth: '50%' }}>
          {brand.name}
        </Text>
      )}
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <Text variant="h3" color={color.main}>
          {title}
        </Text>
        <Text variant="caption" tone="muted">
          {number}
        </Text>
      </View>
    </View>
  );
}
