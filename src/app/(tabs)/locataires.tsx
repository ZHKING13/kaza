import { router } from 'expo-router';
import { Search, UserPlus, UserRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TenantRow } from '@/components/TenantRow';
import { useFormerTenants, usePermissions, useTenantSummaries } from '@/data/store';
import { Avatar } from '@/components/Avatar';
import { formatDate } from '@/lib/format';
import { fonts, radius, type RentStatus, space, useTheme } from '@/theme';

type Filter = 'all' | 'late' | 'partial' | 'paid' | 'upcoming' | 'former';

const order: Record<RentStatus, number> = { late: 0, partial: 1, upcoming: 2, paid: 3, vacant: 4 };

export default function Locataires() {
  const { c } = useTheme();
  const { canManage } = usePermissions();
  const summaries = useTenantSummaries();
  const former = useFormerTenants();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const count = (s: RentStatus) => summaries.filter((x) => x.status === s).length;
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `Tous · ${summaries.length}` },
    { key: 'late', label: `En retard · ${count('late')}` },
    { key: 'partial', label: `Partiel · ${count('partial')}` },
    { key: 'upcoming', label: `À venir · ${count('upcoming')}` },
    { key: 'paid', label: `Payé · ${count('paid')}` },
    ...(former.length ? [{ key: 'former' as const, label: `Anciens · ${former.length}` }] : []),
  ];

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries
      .filter((s) => filter === 'all' || s.status === filter)
      .filter(
        (s) => !q || `${s.tenant.firstName} ${s.tenant.lastName} ${s.unit.label} ${s.property.name}`.toLowerCase().includes(q),
      )
      .sort((a, b) => order[a.status] - order[b.status] || a.tenant.lastName.localeCompare(b.tenant.lastName));
  }, [summaries, query, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen
        title="Locataires"
        bottomInset={96}
        right={
          !canManage ? undefined : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un locataire"
            onPress={() => router.push('/locataire/nouveau')}
            style={({ pressed }) => ({
              minHeight: 48,
              paddingHorizontal: space.md,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: pressed ? c.surfaceAlt : c.surface,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            })}>
            <UserPlus size={20} color={c.primary} />
            <Text variant="bodyStrong" tone="primary">
              Nouveau
            </Text>
          </Pressable>
          )
        }>
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
            placeholder="Nom, unité ou bien"
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
        {filter === 'former' ? (
          <Card padded={false}>
            {former.map((f, i) => (
              <Pressable
                key={f.tenant.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/locataire/[id]', params: { id: f.tenant.id } })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  minHeight: 64,
                  paddingHorizontal: space.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                  backgroundColor: pressed ? c.surfaceAlt : 'transparent',
                })}>
                <Avatar first={f.tenant.firstName} last={f.tenant.lastName} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {f.tenant.firstName} {f.tenant.lastName}
                  </Text>
                  <Text variant="small" tone="muted" numberOfLines={1}>
                    Parti le {formatDate(f.tenant.exitDate!)} · {f.unit.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        ) : (
          <Card padded={false}>
            {list.length === 0 ? (
              <EmptyState icon={UserRound} title="Aucun locataire" body="Aucun locataire ne correspond à cette recherche." />
            ) : (
              list.map((s, i) => <TenantRow key={s.tenant.id} summary={s} first={i === 0} />)
            )}
          </Card>
        )}
      </Screen>
      <Fab />
    </View>
  );
}
