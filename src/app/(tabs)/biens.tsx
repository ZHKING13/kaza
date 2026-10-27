import { router } from 'expo-router';
import { Building2, ChevronRight, CircleAlert, DoorOpen, MapPin, Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { PropertyCover } from '@/components/PropertyCover';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { propertyTypes } from '@/data/propertyTypes';
import { type PropertySummary, usePermissions, usePropertySummaries } from '@/data/store';
import { formatNumber } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';

type Filter = 'all' | 'late' | 'vacant';

function PropertyCard({ s }: { s: PropertySummary }) {
  const { c, status } = useTheme();
  const { property } = s;
  const pct = s.expected ? Math.round((s.collected / s.expected) * 100) : 0;
  return (
    <Card padded={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${property.name}, ${formatNumber(s.collected)} francs encaissés sur ${formatNumber(s.expected)}`}
        onPress={() => router.push({ pathname: '/bien/[id]', params: { id: property.id } })}
        style={({ pressed }) => ({ backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
        {property.photo ? <PropertyCover property={property} height={132} /> : null}
        <View style={{ padding: space.md, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {!property.photo ? (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: c.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {(() => {
                  const Icon = propertyTypes[property.type].icon;
                  return <Icon size={22} color={c.primary} />;
                })()}
              </View>
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" numberOfLines={1}>
                {property.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MapPin size={14} color={c.textMuted} />
                <Text variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {property.district}, {property.city}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={c.textMuted} />
          </View>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.xs }}>
              <Amount value={s.collected} />
              <Text variant="caption" tone="muted">
                encaissés sur {formatNumber(s.expected)}
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: radius.full, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.primary, borderRadius: radius.full }} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: 4 }}>
            <Text variant="small" tone="muted">
              {s.units.length} unité{s.units.length > 1 ? 's' : ''} · {Math.round(s.occupancy * 100)} % occupé
            </Text>
            {s.lateCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CircleAlert size={14} color={status.late.fg} />
                <Text variant="small" color={status.late.fg} style={{ fontFamily: fonts.medium }}>
                  {s.lateCount} en retard
                </Text>
              </View>
            ) : null}
            {s.vacantCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <DoorOpen size={14} color={c.textMuted} />
                <Text variant="small" tone="muted">
                  {s.vacantCount} vacante{s.vacantCount > 1 ? 's' : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Card>
  );
}

export default function Biens() {
  const { c } = useTheme();
  const { can, scoped } = usePermissions();
  // Un membre limité à certains biens n'en crée pas
  const canAdd = can('properties.manage') && !scoped;
  const summaries = usePropertySummaries();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const unitCount = summaries.reduce((n, s) => n + s.units.length, 0);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries
      .filter((s) => filter === 'all' || (filter === 'late' ? s.lateCount > 0 : s.vacantCount > 0))
      .filter((s) => !q || `${s.property.name} ${s.property.district} ${s.property.city}`.toLowerCase().includes(q));
  }, [summaries, query, filter]);

  return (
    <Screen
      title="Biens"
      subtitle={`${summaries.length} biens · ${unitCount} unités`}
      right={
        !canAdd ? undefined : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un bien"
          onPress={() => router.push('/bien/nouveau')}
          style={({ pressed }) => ({
            minHeight: 48,
            paddingHorizontal: space.md,
            borderRadius: radius.full,
            backgroundColor: pressed ? c.primaryPressed : c.primary,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          })}>
          <Plus size={20} color={c.onPrimary} strokeWidth={2.5} />
          <Text variant="bodyStrong" color={c.onPrimary}>
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
          placeholder="Nom ou quartier"
          placeholderTextColor={c.textMuted}
          accessibilityLabel="Rechercher un bien"
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.text, paddingVertical: space.sm }}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        <Chip label="Tous" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Avec impayés · ${summaries.filter((s) => s.lateCount > 0).length}`} selected={filter === 'late'} onPress={() => setFilter('late')} />
        <Chip label={`Unités vacantes · ${summaries.filter((s) => s.vacantCount > 0).length}`} selected={filter === 'vacant'} onPress={() => setFilter('vacant')} />
      </ScrollView>
      {list.length === 0 ? (
        <EmptyState icon={Building2} title="Aucun bien" body="Aucun bien ne correspond à cette recherche." />
      ) : (
        list.map((s) => <PropertyCard key={s.property.id} s={s} />)
      )}
    </Screen>
  );
}
