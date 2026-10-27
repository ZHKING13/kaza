import { router } from 'expo-router';
import { Check, Plus, Smartphone, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { PhoneField } from '@/components/PhoneField';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { type Country, countries, splitPhone } from '@/data/countries';
import { methods } from '@/data/methods';
import { usePermissions, useStore } from '@/data/store';
import type { PayoutAccount, PayoutMethod } from '@/data/types';
import { errorMessage } from '@/lib/api';
import { space, useTheme } from '@/theme';

const PAYOUT_METHODS: PayoutMethod[] = ['wave', 'orange', 'mtn', 'moov'];
const MAX_ACCOUNTS = 4;

type Row = { key: string; method: PayoutMethod; country: Country; national: string; name: string };

const toRow = (a: PayoutAccount, i: number): Row => {
  const { country, national } = splitPhone(a.number, countries[0]);
  return { key: `r${i}`, method: a.method, country, national, name: a.name ?? '' };
};

/**
 * Numéros où les locataires paient directement le bailleur (Wave, Orange Money, MTN, Moov) : affichés dans leur
 * espace, sans frais d'agrégateur. Le locataire signale ensuite son paiement, que le bailleur confirme.
 */
export default function PaiementDirect() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, setPayoutAccounts } = useStore();
  // Les numéros de paiement font partie des réglages de l'espace : propriétaire
  const { isOwner: canManage } = usePermissions();
  const [rows, setRows] = useState<Row[]>(() => (settings.payoutAccounts ?? []).map(toRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (!canManage) {
    return <EmptyState icon={Smartphone} title="Réservé au propriétaire et au gérant" body="Votre rôle ne permet pas de modifier ces numéros." />;
  }

  const update = (key: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () =>
    setRows((all) => [
      ...all,
      {
        key: `n${Date.now()}`,
        method: PAYOUT_METHODS.find((m) => !all.some((r) => r.method === m)) ?? 'wave',
        country: all[0]?.country ?? countries[0],
        national: '',
        name: all[0]?.name ?? '',
      },
    ]);

  const save = async () => {
    const accounts: PayoutAccount[] = [];
    for (const r of rows) {
      const digits = r.national.replace(/\D/g, '');
      if (!digits) continue;
      if (digits.length !== r.country.length) {
        return setError(`Le numéro ${methods[r.method].label} doit compter ${r.country.length} chiffres (${r.country.name}).`);
      }
      const number = `+${r.country.dial}${digits}`;
      if (accounts.some((a) => a.method === r.method && a.number === number)) continue;
      accounts.push({ method: r.method, number, name: r.name.trim() || undefined });
    }
    setSaving(true);
    setError(undefined);
    try {
      await setPayoutAccounts(accounts);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 180 }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">
          Vos locataires voient ces numéros dans leur espace et vous paient directement : l’argent arrive sur votre compte, sans frais
          d’agrégateur. Ils signalent ensuite leur paiement, et vous le confirmez dans Kaza.
        </Text>
        {rows.map((r) => (
          <Card key={r.key} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="bodyStrong">{methods[r.method].label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer le numéro ${methods[r.method].label}`}
                hitSlop={12}
                onPress={() => setRows((all) => all.filter((x) => x.key !== r.key))}>
                <Trash2 size={20} color={c.textMuted} />
              </Pressable>
            </View>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {PAYOUT_METHODS.map((m) => (
                <Chip key={m} label={methods[m].label} selected={r.method === m} onPress={() => update(r.key, { method: m })} />
              ))}
            </View>
            <PhoneField
              label="Numéro"
              country={r.country}
              national={r.national}
              onChange={(country, national) => update(r.key, { country, national })}
            />
            <TextField
              label="Nom affiché par l’opérateur (facultatif)"
              value={r.name}
              onChangeText={(name) => update(r.key, { name })}
              placeholder="Pour que le locataire vérifie avant d’envoyer"
              maxLength={60}
            />
          </Card>
        ))}
        {rows.length < MAX_ACCOUNTS ? (
          <Button label={rows.length ? 'Ajouter un numéro' : 'Ajouter mon numéro Wave ou Mobile Money'} icon={Plus} variant="secondary" onPress={add} />
        ) : null}
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          gap: space.xs,
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}>
        <FormError message={error} />
        <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} icon={Check} onPress={save} disabled={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}
