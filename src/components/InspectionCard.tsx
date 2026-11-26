import { router } from 'expo-router';
import { ChevronRight, ClipboardCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { InspectionKind, Tenant } from '@/data/types';
import { progress } from '@/lib/inspection';
import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** Fiche locataire : états des lieux d'entrée et de sortie (à faire, en cours, signé). */
export function InspectionCard({ tenant }: { tenant: Tenant }) {
  const { c } = useTheme();
  const kinds: InspectionKind[] = tenant.notice || tenant.exitDate || tenant.inspections?.exit ? ['entry', 'exit'] : ['entry'];
  return (
    <View style={{ gap: space.sm }}>
      {kinds.map((kind) => {
        const inspection = tenant.inspections?.[kind];
        const p = inspection ? progress(inspection) : null;
        const label = kind === 'entry' ? 'État des lieux d’entrée' : 'État des lieux de sortie';
        const hint = inspection?.signedAt
          ? 'Signé par les deux parties'
          : p
            ? `En cours · ${p.done}/${p.total} éléments`
            : kind === 'entry'
              ? 'Pièce par pièce, avec photos et signatures'
              : 'À comparer avec l’entrée, avant de rendre la caution';
        return (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={`${label}. ${hint}`}
            onPress={() => router.push({ pathname: '/locataire/[id]/etat-des-lieux', params: { id: tenant.id, kind } })}
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
            <ClipboardCheck size={22} color={c.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{label}</Text>
              <Text variant="small" tone={inspection?.signedAt ? 'primary' : 'muted'}>
                {hint}
              </Text>
            </View>
            <ChevronRight size={20} color={c.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}
