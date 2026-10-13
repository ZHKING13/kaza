import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { methods } from '@/data/methods';
import { useStore } from '@/data/store';
import type { Payment, TenantSummary } from '@/data/types';
import { space, useTheme } from '@/theme';

import { Amount } from './Amount';
import { Avatar } from './Avatar';
import { MethodDot } from './MethodDot';
import { TenantRow } from './TenantRow';
import { Text } from './Text';

/** Ligne de paiement : locataire actif (avec statut du mois) ou ancien locataire. */
export function PaymentRow({ payment, summaries, first }: { payment: Payment; summaries: TenantSummary[]; first?: boolean }) {
  const { c } = useTheme();
  const { tenants, units } = useStore();
  const s = summaries.find((x) => x.tenant.id === payment.tenantId);
  if (s) return <TenantRow summary={s} method={payment.method} amount={payment.amount} first={first} />;

  const tenant = tenants.find((t) => t.id === payment.tenantId);
  if (!tenant) return null;
  const unit = units.find((u) => u.id === tenant.unitId);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/quittance/[id]', params: { id: payment.id } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        minHeight: 64,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
        backgroundColor: pressed ? c.surfaceAlt : 'transparent',
      })}>
      <Avatar first={tenant.firstName} last={tenant.lastName} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {tenant.firstName} {tenant.lastName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MethodDot method={payment.method} />
          <Text variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {methods[payment.method].short} · {unit?.label} · ancien locataire
          </Text>
        </View>
      </View>
      <Amount value={payment.amount} currency={false} />
    </Pressable>
  );
}
