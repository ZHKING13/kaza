import { View } from 'react-native';

import type { Settlement } from '@/data/types';
import { formatAmount } from '@/lib/format';
import { space, useTheme } from '@/theme';

import { Card } from './Card';
import { Text } from './Text';

function Line({ label, amount, sign, first }: { label: string; amount: number; sign: '+' | '−'; first?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: space.sm,
        paddingVertical: space.xs,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
      }}>
      <Text tone="muted" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
        {sign} {formatAmount(amount)}
      </Text>
    </View>
  );
}

/** Détail du solde de tout compte : ce qu'on rend, ce qu'on retient, le résultat. */
export function SettlementSummary({ s }: { s: Omit<Settlement, 'refundMethod'> }) {
  const { c, status } = useTheme();
  const refund = s.balance >= 0;
  return (
    <Card style={{ paddingVertical: space.xs, gap: 0 }}>
      <Line label="Caution versée" amount={s.deposit} sign="+" first />
      {s.prepaid > 0 ? <Line label="Avance non consommée" amount={s.prepaid} sign="+" /> : null}
      {s.arrearsDeducted > 0 ? <Line label="Impayés retenus" amount={s.arrearsDeducted} sign="−" /> : null}
      {s.deductions
        .filter((d) => d.amount > 0)
        .map((d, i) => (
          <Line key={i} label={d.label || 'Retenue'} amount={d.amount} sign="−" />
        ))}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: space.sm,
          paddingTop: space.sm,
          paddingBottom: space.xs,
          borderTopWidth: 2,
          borderTopColor: c.text,
        }}>
        <Text variant="bodyStrong">{refund ? 'À rembourser au locataire' : 'Le locataire doit encore'}</Text>
        <Text variant="h3" color={refund ? c.text : status.late.fg} style={{ fontVariant: ['tabular-nums'] }}>
          {formatAmount(Math.abs(s.balance))}
        </Text>
      </View>
      {s.arrearsLeft > 0 && s.arrearsDeducted === 0 ? (
        <Text variant="small" color={status.late.fg} style={{ paddingBottom: space.xs }}>
          Impayés non retenus sur la caution : {formatAmount(s.arrearsLeft)} restent dus.
        </Text>
      ) : null}
    </Card>
  );
}
