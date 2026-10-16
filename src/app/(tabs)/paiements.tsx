import { Wallet } from 'lucide-react-native';
import { View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Screen } from '@/components/Screen';
import { PaymentRow } from '@/components/PaymentRow';
import { Text } from '@/components/Text';
import { useMonthTotals, useStore, useTenantSummaries } from '@/data/store';
import { useViewPeriod } from '@/data/viewPeriod';
import { formatAmount, formatPeriod } from '@/lib/format';
import { space, useTheme } from '@/theme';

/** Paiements du mois choisi (le mois que règle chaque paiement), avec l'attendu et le reste. */
export default function Paiements() {
  const { c } = useTheme();
  const { payments } = useStore();
  const { period } = useViewPeriod();
  const summaries = useTenantSummaries();
  const totals = useMonthTotals(period);
  const items = payments.filter((p) => p.period === period);
  const total = items.reduce((s, p) => s + p.amount, 0);
  const month = formatPeriod(period);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen title="Paiements" bottomInset={96}>
        <MonthSwitcher />
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm }}>
            <Text variant="small" tone="muted" style={{ flex: 1 }}>
              Loyers de {month} · {items.length} paiement{items.length > 1 ? 's' : ''}
            </Text>
            <Amount value={total} />
          </View>
          {totals.expected > 0 ? (
            <Text variant="caption" tone="muted">
              Attendu {formatAmount(totals.expected)}
              {totals.outstanding > 0 ? ` · reste ${formatAmount(totals.outstanding)}` : ' · tout est encaissé'}
            </Text>
          ) : null}
        </View>
        {items.length ? (
          <Card padded={false}>
            {items.map((p, i) => (
              <PaymentRow key={p.id} payment={p} summaries={summaries} first={i === 0} />
            ))}
          </Card>
        ) : (
          <EmptyState icon={Wallet} title="Aucun paiement" body={`Aucun loyer encaissé pour ${month}.`} />
        )}
      </Screen>
      <Fab />
    </View>
  );
}
