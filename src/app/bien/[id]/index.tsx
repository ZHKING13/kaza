import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building2, Camera, DoorOpen, Plus, UserPlus, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { MethodDot } from '@/components/MethodDot';
import { PropertyCover } from '@/components/PropertyCover';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { StatusBadge } from '@/components/StatusBadge';
import { TenantRow } from '@/components/TenantRow';
import { Text } from '@/components/Text';
import { methods } from '@/data/methods';
import { propertyTypes } from '@/data/propertyTypes';
import { usePermissions, usePropertySummaries, useStore } from '@/data/store';
import { formatAmount, formatDate, formatNumber } from '@/lib/format';
import { pickImage } from '@/lib/images';
import { elevation, fonts, radius, space, useTheme } from '@/theme';

type Tab = 'unites' | 'locataires' | 'historique';

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: c.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          paddingVertical: space.sm,
          paddingHorizontal: space.xs,
          alignItems: 'center',
          gap: 2,
        },
        elevation.raised,
        { shadowOpacity: 0.06, elevation: 2 },
      ]}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

export default function BienDetail() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { payments, setPropertyPhoto } = useStore();
  const { canManage, canCollect } = usePermissions();
  const s = usePropertySummaries().find((x) => x.property.id === id);
  const [tab, setTab] = useState<Tab>('unites');
  const [photoBusy, setPhotoBusy] = useState(false);

  const changePhoto = async () => {
    const uri = await pickImage({ maxSide: 1600, format: 'jpeg', aspect: [16, 9] });
    if (!uri) return;
    setPhotoBusy(true);
    // Échec d'envoi refusé par le serveur : la photo reste affichée jusqu'à la prochaine synchronisation
    await setPropertyPhoto(id, uri).catch(() => {});
    setPhotoBusy(false);
  };

  if (!s) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <EmptyState icon={Building2} title="Bien introuvable" body="Ce bien a peut-être été supprimé." />
      </SafeAreaView>
    );
  }

  const { property } = s;
  const hasPhoto = !!property.photo;
  const onCover = hasPhoto ? '#FFFFFF' : c.text;
  const tenantIds = new Set(s.tenants.map((t) => t.tenant.id));
  const history = payments
    .filter((p) => tenantIds.has(p.tenantId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.period.localeCompare(a.period));
  const outstanding = s.expected - s.collected;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}>
        <PropertyCover property={property} height={220 + insets.top} scrim>
          <View style={{ flex: 1, paddingTop: insets.top + space.xs, paddingHorizontal: space.md, paddingBottom: space.xl + space.lg }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/biens'))}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hasPhoto ? 'rgba(15,23,42,0.45)' : pressed ? c.surfaceAlt : c.surface,
              })}>
              <ArrowLeft size={22} color={hasPhoto ? '#FFFFFF' : c.text} />
            </Pressable>
            {canManage ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={hasPhoto ? 'Changer la photo' : 'Ajouter une photo'}
                onPress={changePhoto}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top: insets.top + space.xs,
                  right: space.md,
                  height: 44,
                  paddingHorizontal: space.sm,
                  borderRadius: radius.full,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: hasPhoto ? 'rgba(15,23,42,0.45)' : pressed ? c.surfaceAlt : c.surface,
                })}>
                <Camera size={18} color={hasPhoto ? '#FFFFFF' : c.text} />
                <Text variant="small" color={hasPhoto ? '#FFFFFF' : c.text}>
                  {photoBusy ? 'Envoi…' : hasPhoto ? 'Changer la photo' : 'Ajouter une photo'}
                </Text>
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }} />
            <View style={{ gap: 4 }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: c.primary,
                  borderRadius: radius.full,
                  paddingHorizontal: 10,
                  paddingVertical: 2,
                }}>
                <Text variant="label" color={c.onPrimary}>
                  {propertyTypes[property.type].label}
                </Text>
              </View>
              <Text variant="h1" color={onCover} accessibilityRole="header">
                {property.name}
              </Text>
              <Text variant="small" color={hasPhoto ? '#FFFFFF' : c.textMuted}>
                {property.district}, {property.city}
              </Text>
            </View>
          </View>
        </PropertyCover>

        <View style={{ paddingHorizontal: space.md, marginTop: -space.xl, gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <Tile label="Encaissé">
              <Text variant="h3" tone="primary" style={{ fontVariant: ['tabular-nums'] }} adjustsFontSizeToFit numberOfLines={1}>
                {formatNumber(s.collected)}
              </Text>
            </Tile>
            <Tile label="Attendu">
              <Text variant="h3" style={{ fontVariant: ['tabular-nums'] }} adjustsFontSizeToFit numberOfLines={1}>
                {formatNumber(s.expected)}
              </Text>
            </Tile>
            <Tile label="Occupation">
              <Text variant="h3" style={{ fontVariant: ['tabular-nums'] }}>
                {Math.round(s.occupancy * 100)} %
              </Text>
            </Tile>
          </View>
          <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: -space.xs }}>
            Montants du mois en FCFA{outstanding > 0 ? ` · ${formatAmount(outstanding)} restent à encaisser` : ''}
          </Text>

          <SegmentedTabs
            tabs={[
              { key: 'unites', label: `Unités · ${s.units.length}` },
              { key: 'locataires', label: 'Locataires' },
              { key: 'historique', label: 'Historique' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'unites' ? (
            <View style={{ gap: space.sm }}>
              <Card padded={false}>
                {s.units.map((u, i) => {
                  const t = s.tenants.find((x) => x.unit.id === u.id);
                  const row = (
                    <>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="bodyStrong">{u.label}</Text>
                        {t ? (
                          <Text variant="small" tone="muted" numberOfLines={1}>
                            {t.tenant.firstName} {t.tenant.lastName}
                          </Text>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <UserPlus size={14} color={c.primary} />
                            <Text variant="small" tone="primary" style={{ fontFamily: fonts.medium }}>
                              Ajouter un locataire
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Amount value={u.rent} currency={false} />
                        <StatusBadge status={t ? t.status : 'vacant'} />
                      </View>
                    </>
                  );
                  const rowStyle = {
                    flexDirection: 'row' as const,
                    alignItems: 'center' as const,
                    gap: space.sm,
                    minHeight: 64,
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  };
                  return (
                    <Pressable
                      key={u.id}
                      accessibilityRole="button"
                      accessibilityLabel={t ? undefined : `${u.label}, vacante : ajouter un locataire`}
                      disabled={!t && !canManage}
                      onPress={() =>
                        t
                          ? router.push({ pathname: '/locataire/[id]', params: { id: t.tenant.id } })
                          : router.push({ pathname: '/locataire/nouveau', params: { unitId: u.id } })
                      }
                      style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? c.surfaceAlt : 'transparent' }]}>
                      {row}
                    </Pressable>
                  );
                })}
              </Card>
              {canManage ? (
              <Button
                label="Ajouter des unités"
                icon={Plus}
                variant="secondary"
                onPress={() => router.push({ pathname: '/bien/[id]/unites', params: { id: property.id } })}
              />
              ) : null}
            </View>
          ) : null}

          {tab === 'locataires' ? (
            <Card padded={false}>
              {s.tenants.length ? (
                s.tenants.map((t, i) => <TenantRow key={t.tenant.id} summary={t} first={i === 0} />)
              ) : (
                <EmptyState icon={UserRound} title="Aucun locataire" body="Les locataires de ce bien apparaîtront ici." />
              )}
            </Card>
          ) : null}

          {tab === 'historique' ? (
            <Card padded={false}>
              {history.length ? (
                history.map((p, i) => {
                  const t = s.tenants.find((x) => x.tenant.id === p.tenantId)!;
                  return (
                    <View
                      key={p.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                        minHeight: 56,
                        paddingHorizontal: space.md,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: c.border,
                      }}>
                      <MethodDot method={p.method} size={10} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {t.tenant.firstName} {t.tenant.lastName} · {t.unit.label}
                        </Text>
                        <Text variant="small" tone="muted">
                          {formatDate(p.date)} · {methods[p.method].label}
                        </Text>
                      </View>
                      <Amount value={p.amount} currency={false} />
                    </View>
                  );
                })
              ) : (
                <EmptyState icon={DoorOpen} title="Aucun paiement" body="Les paiements reçus pour ce bien apparaîtront ici." />
              )}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {canCollect && (s.lateCount > 0 || s.tenants.some((t) => t.status !== 'paid')) ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: space.md,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.sm,
            backgroundColor: c.bg,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}>
          <Button
            label="Encaisser un loyer"
            icon={Plus}
            haptic
            onPress={() => router.push({ pathname: '/encaisser', params: { propertyId: property.id } })}
          />
        </View>
      ) : null}
    </View>
  );
}
