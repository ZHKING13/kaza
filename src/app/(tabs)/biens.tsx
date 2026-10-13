import { ChevronRight, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { Text } from '@/components/Text';
import { useStore, useTenantSummaries } from '@/data/store';
import { formatNumber } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

export default function Biens() {
  const { c, status } = useTheme();
  const { properties, lots } = useStore();
  const summaries = useTenantSummaries();

  return (
    <Screen title="Biens" subtitle={`${properties.length} biens · ${lots.length} lots`}>
      {properties.map((p) => {
        const pLots = lots.filter((l) => l.propertyId === p.id);
        const pSum = summaries.filter((s) => s.property.id === p.id);
        const expected = pSum.reduce((s, x) => s + x.due, 0);
        const collected = pSum.reduce((s, x) => s + Math.min(x.paid, x.due), 0);
        const vacant = pLots.length - pSum.length;
        const late = pSum.filter((x) => x.status === 'late' || x.status === 'partial').length;
        const pct = expected ? collected / expected : 0;
        return (
          <Card key={p.id} padded={false}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => ({ padding: space.md, gap: space.sm, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h3">{p.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MapPin size={14} color={c.textMuted} />
                    <Text variant="small" tone="muted">
                      {p.district}, {p.city}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={c.textMuted} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Amount value={collected} />
                <Text variant="caption" tone="muted">
                  sur {formatNumber(expected)} attendus
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: radius.full, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: c.primary }} />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                <Text variant="small" tone="muted" style={{ marginRight: space.xs }}>
                  {pLots.length} lots
                </Text>
                {late > 0 ? (
                  <Text variant="small" color={status.late.fg}>
                    {late} en retard
                  </Text>
                ) : null}
              </View>
              {vacant > 0 ? <StatusBadge status="vacant" style={{ alignSelf: 'flex-start' }} /> : null}
            </Pressable>
          </Card>
        );
      })}
    </Screen>
  );
}
