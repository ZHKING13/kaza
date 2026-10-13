import { View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { Fab } from '@/components/Fab';
import { Screen } from '@/components/Screen';
import { TenantRow } from '@/components/TenantRow';
import { Text } from '@/components/Text';
import { useStore, useTenantSummaries } from '@/data/store';
import type { Payment } from '@/data/types';
import { formatPeriod } from '@/lib/format';
import { space, useTheme } from '@/theme';

export default function Paiements() {
  const { c } = useTheme();
  const { payments } = useStore();
  const summaries = useTenantSummaries();

  const groups = payments.reduce<Record<string, Payment[]>>((acc, p) => {
    (acc[p.period] ??= []).push(p);
    return acc;
  }, {});
  const periods = Object.keys(groups).sort().reverse();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen title="Paiements" bottomInset={96}>
        {periods.map((period) => {
          const items = groups[period];
          const total = items.reduce((s, p) => s + p.amount, 0);
          return (
            <View key={period} style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text variant="h3" style={{ textTransform: 'capitalize' }}>
                  {formatPeriod(period)}
                </Text>
                <Amount value={total} variant="small" tone="muted" />
              </View>
              <Card padded={false}>
                {items.map((p, i) => {
                  const s = summaries.find((x) => x.tenant.id === p.tenantId)!;
                  return <TenantRow key={p.id} summary={s} method={p.method} amount={p.amount} first={i === 0} />;
                })}
              </Card>
            </View>
          );
        })}
      </Screen>
      <Fab />
    </View>
  );
}
