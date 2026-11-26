import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Camera, Check, ClipboardCheck, ImagePlus, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { PdfButton } from '@/components/PdfButton';
import { SignaturePad } from '@/components/SignaturePad';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { usePermissions, useStore } from '@/data/store';
import type { Inspection, InspectionCondition, InspectionItem, InspectionKind, InspectionMeter } from '@/data/types';
import { errorMessage } from '@/lib/api';
import { formatAmount } from '@/lib/format';
import { pickImage, takePhoto } from '@/lib/images';
import { conditionLabels, conditionOrder, inspectionFileName, inspectionHtml, newInspection, newItem, newRoom, worse } from '@/lib/inspection';
import { radius, space, useTheme } from '@/theme';

/** Photo d'un élément : lisible, et assez légère pour partir en 3G */
const PHOTO = { maxSide: 1280, format: 'jpeg' as const };

const isoDay = (iso: string) => iso.slice(0, 10);
const noonOf = (day: string) => `${day}T12:00:00.000Z`;
const digits = (v: string) => v.replace(/\D/g, '');

type PhotoTarget = { roomId: string; itemId: string } | { meter: 'electricity' | 'water' };

/**
 * État des lieux d'entrée ou de sortie, pièce par pièce, sur place et même sans réseau : état de chaque élément,
 * photos, compteurs, clés, signatures du bailleur et du locataire sur le même téléphone. À la sortie, chaque élément
 * montre son état à l'entrée ; une dégradation peut recevoir un montant, repris dans le solde de tout compte.
 */
export default function EtatDesLieux() {
  const { c } = useTheme();
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind: InspectionKind = kindParam === 'exit' ? 'exit' : 'entry';
  const { tenants, units, properties, profile, identity, today, saveInspection, addInspectionPhoto } = useStore();
  const { can } = usePermissions();
  const tenant = tenants.find((t) => t.id === id);
  const unit = units.find((u) => u.id === tenant?.unitId);
  const property = properties.find((p) => p.id === unit?.propertyId);
  const entry = tenant?.inspections?.entry;
  const saved = tenant?.inspections?.[kind];

  const [draft, setDraft] = useState<Inspection | null>(() =>
    saved ??
    (property
      ? newInspection(Crypto.randomUUID(), kind, property.type, isoDay(kind === 'entry' && tenant?.entryDate ? tenant.entryDate : today.toISOString()), kind === 'exit' ? entry : undefined)
      : null),
  );
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [newRoomName, setNewRoomName] = useState('');
  const [newItems, setNewItems] = useState<Record<string, string>>({});

  if (!tenant || !unit || !property || !draft || !can('leases.manage')) {
    return <EmptyState icon={ClipboardCheck} title="État des lieux indisponible" body="Ce locataire n’existe plus, ou votre rôle ne permet pas de gérer les baux." />;
  }
  const title = kind === 'entry' ? 'État des lieux d’entrée' : 'État des lieux de sortie';
  const photoUrl = new Map((tenant.inspections?.[kind]?.photos ?? []).map((p) => [p.id, p.url]));
  const entryItem = (roomId: string, itemId: string) => entry?.rooms.find((r) => r.id === roomId)?.items.find((i) => i.id === itemId);

  const update = (patch: Partial<Inspection>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateItem = (roomId: string, itemId: string, patch: Partial<InspectionItem>) =>
    setDraft((d) =>
      d
        ? { ...d, rooms: d.rooms.map((r) => (r.id !== roomId ? r : { ...r, items: r.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) })) }
        : d,
    );
  const deductionOf = (roomId: string, itemId: string) => draft.deductions.find((x) => x.roomId === roomId && x.itemId === itemId);
  const setDeduction = (roomId: string, itemId: string, label: string, amount: number) =>
    update({
      deductions: [
        ...draft.deductions.filter((x) => !(x.roomId === roomId && x.itemId === itemId)),
        ...(amount > 0 ? [{ roomId, itemId, label, amount }] : []),
      ],
    });
  const setMeter = (which: 'electricity' | 'water', patch: Partial<NonNullable<InspectionMeter>>) =>
    update({ meters: { ...draft.meters, [which]: { number: null, index: null, photoId: null, ...draft.meters[which], ...patch } } });

  const save = async (next: Inspection = draft, quiet = false) => {
    setBusy(!quiet);
    setError(undefined);
    try {
      await saveInspection(tenant.id, next);
      if (!quiet) setNote(next.landlordSignature && next.tenantSignature ? 'Enregistré et signé.' : 'Enregistré.');
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  /** Photo : l'état des lieux est d'abord enregistré (la photo s'y rattache), puis la pièce reçoit l'identifiant. */
  const addPhoto = async (target: PhotoTarget) => {
    const key = 'meter' in target ? target.meter : `${target.roomId}/${target.itemId}`;
    setPhotoBusy(key);
    setError(undefined);
    try {
      const uri = Platform.OS === 'web' ? await pickImage(PHOTO) : await takePhoto(PHOTO);
      if (!uri) return;
      await save(draft, true);
      const photoId = await addInspectionPhoto(tenant.id, kind, uri);
      const next: Inspection =
        'meter' in target
          ? { ...draft, meters: { ...draft.meters, [target.meter]: { number: null, index: null, ...draft.meters[target.meter], photoId } } }
          : {
              ...draft,
              rooms: draft.rooms.map((r) =>
                r.id !== target.roomId ? r : { ...r, items: r.items.map((it) => (it.id === target.itemId ? { ...it, photoIds: [...it.photoIds, photoId] } : it)) },
              ),
            };
      setDraft(next);
      await save(next, true);
    } catch (e) {
      setError(e instanceof Error && e.message === 'camera' ? 'Autorisez l’appareil photo dans les réglages du téléphone.' : errorMessage(e));
    } finally {
      setPhotoBusy(undefined);
    }
  };

  const thumbs = (ids: string[]) =>
    ids.length ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {ids.map((pid) => {
          const url = photoUrl.get(pid);
          return url ? (
            <Image key={pid} source={{ uri: url }} style={{ width: 64, height: 48, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }} />
          ) : (
            <View key={pid} style={{ width: 64, height: 48, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }} />
          );
        })}
      </View>
    ) : null;

  const photoButton = (target: PhotoTarget, label: string) => {
    const key = 'meter' in target ? target.meter : `${target.roomId}/${target.itemId}`;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Photo : ${label}`}
        disabled={!!photoBusy}
        hitSlop={8}
        onPress={() => addPhoto(target)}
        style={{ padding: 6, borderRadius: radius.full, backgroundColor: c.surfaceAlt, opacity: photoBusy === key ? 0.4 : 1 }}>
        {Platform.OS === 'web' ? <ImagePlus size={18} color={c.primary} /> : <Camera size={18} color={c.primary} />}
      </Pressable>
    );
  };

  const total = draft.deductions.reduce((s, x) => s + x.amount, 0);
  const html = () => inspectionHtml({ identity, profile, tenant, unit, property, inspection: { ...draft, photos: tenant.inspections?.[kind]?.photos ?? [] }, entry });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">
          {kind === 'entry'
            ? `Faites le tour de ${unit.label} avec ${tenant.firstName} : l’état de chaque élément, une photo de ce qui compte. Tout reste sur le téléphone sans réseau.`
            : entry
              ? 'Chaque élément montre son état à l’entrée. S’il s’est dégradé (hors usure normale), indiquez le montant à retenir sur la caution.'
              : 'Aucun état des lieux d’entrée n’a été fait dans Kaza : notez l’état de chaque élément.'}
        </Text>

        <DateField label="Date" value={noonOf(draft.date)} onChange={(iso) => update({ date: isoDay(iso) })} />

        {draft.rooms.map((room) => (
          <Card key={room.id} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="h3" accessibilityRole="header">
                {room.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer la pièce ${room.name}`}
                hitSlop={10}
                onPress={() => update({ rooms: draft.rooms.filter((r) => r.id !== room.id), deductions: draft.deductions.filter((x) => x.roomId !== room.id) })}>
                <Trash2 size={18} color={c.textMuted} />
              </Pressable>
            </View>
            {room.items.map((item) => {
              const before = entryItem(room.id, item.id)?.condition;
              const damaged = kind === 'exit' && worse(before, item.condition);
              const deduction = deductionOf(room.id, item.id);
              const key = `${room.id}/${item.id}`;
              return (
                <View key={item.id} style={{ gap: 6, paddingTop: space.xs, borderTopWidth: 1, borderTopColor: c.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{item.label}</Text>
                      {kind === 'exit' && before ? (
                        <Text variant="caption" tone="muted">
                          À l’entrée : {conditionLabels[before]}
                        </Text>
                      ) : null}
                    </View>
                    {photoButton({ roomId: room.id, itemId: item.id }, item.label)}
                  </View>
                  <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {conditionOrder.map((cond: InspectionCondition) => (
                      <Chip
                        key={cond}
                        label={conditionLabels[cond]}
                        selected={item.condition === cond}
                        onPress={() => updateItem(room.id, item.id, { condition: item.condition === cond ? null : cond })}
                      />
                    ))}
                  </View>
                  {thumbs(item.photoIds)}
                  {openComments[key] || item.comment ? (
                    <TextField
                      label="Commentaire"
                      value={item.comment ?? ''}
                      onChangeText={(v) => updateItem(room.id, item.id, { comment: v || null })}
                      maxLength={500}
                    />
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => setOpenComments({ ...openComments, [key]: true })}>
                      <Text variant="small" tone="primary">
                        + Ajouter un commentaire
                      </Text>
                    </Pressable>
                  )}
                  {damaged || deduction ? (
                    <TextField
                      label="Montant à retenir sur la caution"
                      helper="Réparation ou remplacement, sur devis ou facture"
                      value={deduction ? String(deduction.amount) : ''}
                      onChangeText={(v) => setDeduction(room.id, item.id, `${room.name} : ${item.label.toLowerCase()}`, Number(digits(v) || 0))}
                      keyboardType="number-pad"
                      suffix="FCFA"
                    />
                  ) : null}
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Ajouter un élément"
                  value={newItems[room.id] ?? ''}
                  onChangeText={(v) => setNewItems({ ...newItems, [room.id]: v })}
                  placeholder="Ex. climatiseur"
                  maxLength={80}
                />
              </View>
              <Button
                label="Ajouter"
                icon={Plus}
                variant="secondary"
                compact
                disabled={!newItems[room.id]?.trim()}
                onPress={() => {
                  const label = newItems[room.id].trim();
                  update({ rooms: draft.rooms.map((r) => (r.id === room.id ? { ...r, items: [...r.items, newItem(label, Date.now())] } : r)) });
                  setNewItems({ ...newItems, [room.id]: '' });
                }}
              />
            </View>
          </Card>
        ))}

        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField label="Ajouter une pièce" value={newRoomName} onChangeText={setNewRoomName} placeholder="Ex. Chambre 3" maxLength={60} />
            </View>
            <Button
              label="Ajouter"
              icon={Plus}
              variant="secondary"
              compact
              disabled={!newRoomName.trim()}
              onPress={() => {
                update({ rooms: [...draft.rooms, newRoom(newRoomName.trim(), ['Murs et peinture', 'Sol', 'Portes et serrures', 'Prises et éclairage'], Date.now())] });
                setNewRoomName('');
              }}
            />
          </View>
        </Card>

        <Card style={{ gap: space.sm }}>
          <Text variant="h3" accessibilityRole="header">
            Compteurs
          </Text>
          {(['electricity', 'water'] as const).map((which) => (
            <View key={which} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong">{which === 'electricity' ? 'Électricité (CIE)' : 'Eau (SODECI)'}</Text>
                {photoButton({ meter: which }, which === 'electricity' ? 'compteur d’électricité' : 'compteur d’eau')}
              </View>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <View style={{ flex: 1 }}>
                  <TextField label="Numéro" value={draft.meters[which]?.number ?? ''} onChangeText={(v) => setMeter(which, { number: v || null })} maxLength={40} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Index"
                    value={draft.meters[which]?.index ?? ''}
                    onChangeText={(v) => setMeter(which, { index: v || null })}
                    keyboardType="decimal-pad"
                    maxLength={20}
                  />
                </View>
              </View>
              {draft.meters[which]?.photoId ? thumbs([draft.meters[which]!.photoId!]) : null}
            </View>
          ))}
        </Card>

        <Card style={{ gap: space.sm }}>
          <Text variant="h3" accessibilityRole="header">
            Clés remises
          </Text>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Logement"
                value={draft.keys.unit === null ? '' : String(draft.keys.unit)}
                onChangeText={(v) => update({ keys: { ...draft.keys, unit: digits(v) ? Number(digits(v)) : null } })}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Portail ou cour"
                value={draft.keys.gate === null ? '' : String(draft.keys.gate)}
                onChangeText={(v) => update({ keys: { ...draft.keys, gate: digits(v) ? Number(digits(v)) : null } })}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <TextField label="Autres (badge, télécommande…)" value={draft.keys.other ?? ''} onChangeText={(v) => update({ keys: { ...draft.keys, other: v || null } })} maxLength={120} />
        </Card>

        <TextField label="Observations" value={draft.observations ?? ''} onChangeText={(v) => update({ observations: v || null })} multiline maxLength={2000} />

        {kind === 'exit' ? (
          <Card style={{ gap: 4 }}>
            <Text variant="h3">Retenues sur la caution</Text>
            {draft.deductions.length ? (
              draft.deductions.map((x) => (
                <View key={`${x.roomId}/${x.itemId}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <Text variant="small" style={{ flex: 1 }}>
                    {x.label}
                  </Text>
                  <Text variant="small">{formatAmount(x.amount)}</Text>
                </View>
              ))
            ) : (
              <Text variant="small" tone="muted">
                Aucune dégradation chiffrée.
              </Text>
            )}
            {total ? <Text variant="bodyStrong">Total : {formatAmount(total)}</Text> : null}
          </Card>
        ) : null}

        <Card style={{ gap: space.md }}>
          <Text variant="h3" accessibilityRole="header">
            Signatures
          </Text>
          <Text variant="small" tone="muted">
            Faites signer chacun sur ce téléphone, une fois l’état des lieux relu ensemble.
          </Text>
          <SignaturePad label="Le bailleur" value={draft.landlordSignature} onChange={(p) => update({ landlordSignature: p })} />
          <SignaturePad label={`Le locataire · ${tenant.firstName} ${tenant.lastName}`} value={draft.tenantSignature} onChange={(p) => update({ tenantSignature: p })} />
        </Card>

        <FormError message={error} />
        {note ? (
          <Text variant="small" tone="primary">
            {note}
          </Text>
        ) : null}
        <Button label={busy ? 'Enregistrement…' : 'Enregistrer'} icon={Check} variant="secondary" disabled={busy} onPress={() => save().catch(() => {})} />
        <PdfButton label="Partager l’état des lieux (PDF)" html={html} fileName={inspectionFileName(tenant, kind)} variant="primary" />
        {kind === 'exit' && total > 0 && !tenant.exitDate ? (
          <Button
            label={`Enregistrer le départ avec ${formatAmount(total)} de retenues`}
            variant="secondary"
            onPress={async () => {
              await save(draft, true).catch(() => {});
              router.push({ pathname: '/locataire/[id]/depart', params: { id: tenant.id } });
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
