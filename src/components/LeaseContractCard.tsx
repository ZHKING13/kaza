import { router } from 'expo-router';
import { ChevronRight, FileSignature } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Tenant } from '@/data/types';
import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** Fiche locataire : accès au contrat de bail (à compléter, prêt, signé). */
export function LeaseContractCard({ tenant }: { tenant: Tenant }) {
  const { c } = useTheme();
  const contract = tenant.contract;
  const pages = contract?.pages.length ?? 0;
  const filled = !!contract && (!!contract.tenant.idNumber || !!contract.terms.electricity || !!contract.terms.water);
  const hint = pages
    ? `Contrat signé · ${pages} page${pages > 1 ? 's' : ''}`
    : filled
      ? 'Prêt à partager ou à imprimer'
      : 'Pièce d’identité, charges, garant : à compléter';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Contrat de bail. ${hint}`}
      onPress={() => router.push({ pathname: '/locataire/[id]/bail', params: { id: tenant.id } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.surfaceAlt : c.surface,
      })}>
      <FileSignature size={22} color={c.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">Contrat de bail</Text>
        <Text variant="small" tone={pages ? 'primary' : 'muted'}>
          {hint}
        </Text>
      </View>
      <ChevronRight size={20} color={c.textMuted} />
    </Pressable>
  );
}
