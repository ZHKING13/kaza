import { Search, UserRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { Screen } from '@/components/Screen';
import { TenantRow } from '@/components/TenantRow';
import { useTenantSummaries } from '@/data/store';
import { fonts, radius, type RentStatus, space, useTheme } from '@/theme';

type Filter = 'all' | 'late' | 'partial' | 'paid' | 'upcoming';

const order: Record<RentStatus, number> = { late: 0, partial: 1, upcoming: 2, paid: 3, vacant: 4 };

export default function Locataires() {
  const { c } = useTheme();
  const summaries = useTenantSummaries();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const count = (s: RentStatus) => summaries.filter((x) => x.status === s).length;
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `Tous · ${summaries.length}` },
    { key: 'late', label: `En retard · ${count('late')}` },
    { key: 'partial', label: `Partiel · ${count('partial')}` },
    { key: 'upcoming', label: `À venir · ${count('upcoming')}` },
    { key: 'paid', label: `Payé · ${count('paid')}` },
  ];

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries
      .filter((s) => filter === 'all' || s.status === filter)
      .filter(
        (s) =>
          !q ||
          `${s.tenant.firstName} ${s.tenant.lastName} ${s.lot.label} ${s.property.name}`.toLowerCase().includes(q),
      )
      .sort((a, b) => order[a.status] - order[b.status] || a.tenant.lastName.localeCompare(b.tenant.lastName));
  }, [summaries, query, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen title="Locataires" bottomInset={96}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            paddingHorizontal: space.sm,
            minHeight: 48,
          }}>
          <Search size={20} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nom, lot ou bien"
            placeholderTextColor={c.textMuted}
            accessibilityLabel="Rechercher un locataire"
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.text, paddingVertical: space.sm }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          {filters.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
        <Card padded={false}>
          {list.length === 0 ? (
            <EmptyState icon={UserRound} title="Aucun locataire" body="Aucun locataire ne correspond à cette recherche." />
          ) : (
            list.map((s, i) => <TenantRow key={s.tenant.id} summary={s} first={i === 0} />)
          )}
        </Card>
      </Screen>
      <Fab />
    </View>
  );
}
