import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { methods } from '@/data/methods';
import type { PaymentMethod, TenantSummary } from '@/data/types';
import { formatDayMonth } from '@/lib/format';
import { space, useTheme } from '@/theme';

import { Amount } from './Amount';
import { Avatar } from './Avatar';
import { MethodDot } from './MethodDot';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';

type Props = {
  summary: TenantSummary;
  /** Mode de paiement du dernier encaissement, si on affiche un paiement */
  method?: PaymentMethod;
  amount?: number;
  first?: boolean;
};

export function TenantRow({ summary, method, amount, first }: Props) {
  const { c } = useTheme();
  const { tenant, unit, status, dueDate } = summary;
  const sub = method
    ? `${methods[method].short} · ${unit.label}`
    : tenant.exitDate
      ? `Parti le ${formatDayMonth(tenant.exitDate)} · ${unit.label}`
      : status === 'paid'
        ? `${unit.label} · ${summary.property.name}`
        : `Échéance ${formatDayMonth(dueDate)} · ${unit.label}`;

  return (
    <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/locataire/[id]', params: { id: tenant.id } })}
        android_ripple={{ color: c.surfaceAlt }}
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
            {method ? <MethodDot method={method} /> : null}
            <Text variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {sub}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Amount value={amount ?? summary.rent} currency={false} />
          <StatusBadge status={status} arrears={summary.arrears} />
        </View>
      </Pressable>
  );
}
