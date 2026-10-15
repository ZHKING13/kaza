import { router } from 'expo-router';
import { Camera, Check, Repeat, Square, SquareCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Chip } from './Chip';
import { DateField } from './DateField';
import { FormError } from './FormError';
import { Text } from './Text';
import { TextField } from './TextField';
import { expenseCategories, expenseCategoryIds, expenseMethodIds, expenseMethods } from '@/data/expenses';
import { useStore } from '@/data/store';
import type { Expense, ExpenseCategory, ExpenseMethod } from '@/data/types';
import { errorMessage } from '@/lib/api';
import { formatAmount, formatNumber } from '@/lib/format';
import { pickImage } from '@/lib/images';
import { radius, space, useTheme } from '@/theme';

type Props = {
  propertyId: string;
  /** Dépense existante : modification */
  expense?: Expense;
  readOnly?: boolean;
};

/** Saisie ou modification d'une dépense : montant, catégorie, date, unité, moyen, fournisseur, justificatif. */
export function ExpenseForm({ propertyId, expense, readOnly }: Props) {
  const { c, status } = useTheme();
  const insets = useSafeAreaInsets();
  const { units, today, addExpense, updateExpense, setExpenseReceipt } = useStore();
  const propertyUnits = units.filter((u) => u.propertyId === propertyId);

  const [amount, setAmount] = useState(expense?.amount ?? 0);
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'works');
  const [date, setDate] = useState(expense?.date ?? today.toISOString());
  const [unitId, setUnitId] = useState<string | undefined>(expense?.unitId);
  const [method, setMethod] = useState<ExpenseMethod>(expense?.method ?? 'cash');
  const [supplier, setSupplier] = useState(expense?.supplier ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [receipt, setReceipt] = useState<string | undefined>(expense?.receipt);
  const [repeat, setRepeat] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const invalid = amount <= 0 ? 'Indiquez le montant de la dépense.' : undefined;
  const day = new Date(date).getDate();

  const takeReceipt = async () => {
    const uri = await pickImage({ maxSide: 1600, format: 'jpeg' });
    if (!uri) return;
    setReceipt(uri);
    if (expense) await setExpenseReceipt(expense.id, uri).catch((e) => setError(errorMessage(e)));
  };
  const removeReceipt = async () => {
    setReceipt(undefined);
    if (expense) await setExpenseReceipt(expense.id, null).catch((e) => setError(errorMessage(e)));
  };

  const save = async () => {
    setSubmitted(true);
    if (invalid || saving) return;
    setSaving(true);
    setError(undefined);
    const fields = {
      amount,
      category,
      date,
      unitId,
      method,
      supplier: supplier.trim() || undefined,
      note: note.trim() || undefined,
    };
    try {
      if (expense) await updateExpense(expense.id, fields);
      else await addExpense({ ...fields, propertyId, repeatMonthly: repeat, receipt });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const chips = <T extends string>(options: T[], selected: T | undefined, label: (v: T) => string, onPick: (v: T) => void) => (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {options.map((o) => (
        <Chip key={o} label={label(o)} selected={selected === o} onPress={() => !readOnly && onPick(o)} />
      ))}
    </View>
  );
  const section = (title: string, children: React.ReactNode) => (
    <View style={{ gap: 6 }}>
      <Text variant="label" style={{ fontSize: 14 }}>
        {title}
      </Text>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        <TextField
          label="Montant"
          keyboardType="number-pad"
          value={amount ? formatNumber(amount) : ''}
          onChangeText={(t) => setAmount(Number(t.replace(/\D/g, '')) || 0)}
          suffix="FCFA"
          editable={!readOnly}
          error={submitted ? invalid : undefined}
          style={{ fontVariant: ['tabular-nums'] }}
        />
        {section(
          'Catégorie',
          chips(expenseCategoryIds, category, (k) => expenseCategories[k].label, setCategory),
        )}
        <DateField label="Date" value={date} onChange={setDate} max={today} />
        {propertyUnits.length > 1
          ? section(
              'Concerne',
              chips(['', ...propertyUnits.map((u) => u.id)], unitId ?? '', (k) => (k ? propertyUnits.find((u) => u.id === k)!.label : 'Tout le bien'), (k) =>
                setUnitId(k || undefined),
              ),
            )
          : null}
        {section(
          'Payé par',
          chips(expenseMethodIds, method, (k) => expenseMethods[k].label, setMethod),
        )}
        <TextField
          label="Fournisseur (facultatif)"
          value={supplier}
          onChangeText={setSupplier}
          placeholder="Plomberie Yao, CIE, gardien…"
          maxLength={120}
          editable={!readOnly}
        />
        <TextField
          label="Note (facultatif)"
          value={note}
          onChangeText={setNote}
          placeholder="Fuite dans la cuisine"
          maxLength={500}
          editable={!readOnly}
        />

        {section(
          'Justificatif',
          receipt ? (
            <View style={{ gap: space.xs }}>
              <Image
                source={{ uri: receipt }}
                accessibilityLabel="Photo du justificatif"
                style={{ width: '100%', height: 220, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}
                resizeMode="contain"
              />
              {!readOnly ? (
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <Button label="Changer" icon={Camera} variant="secondary" compact onPress={takeReceipt} />
                  <Button label="Retirer" icon={Trash2} variant="ghost" compact onPress={removeReceipt} />
                </View>
              ) : null}
            </View>
          ) : readOnly ? (
            <Text variant="small" tone="muted">
              Aucun justificatif.
            </Text>
          ) : (
            <Button label="Photographier le reçu ou la facture" icon={Camera} variant="secondary" onPress={takeReceipt} />
          ),
        )}

        {!expense && !readOnly ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: repeat }}
            onPress={() => setRepeat(!repeat)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              padding: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: repeat ? c.primary : c.border,
              backgroundColor: repeat ? c.primarySoft : c.surface,
            }}>
            {repeat ? <SquareCheck size={24} color={c.primary} /> : <Square size={24} color={c.textMuted} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">Répéter chaque mois</Text>
              <Text variant="small" tone="muted">
                {repeat && amount > 0
                  ? `${formatAmount(amount)} ajoutés automatiquement le ${Math.min(day, 28)} de chaque mois (gardien, abonnement…).`
                  : 'Pour une dépense qui revient : gardien, abonnement, entretien…'}
              </Text>
            </View>
            <Repeat size={18} color={repeat ? c.primary : c.textMuted} />
          </Pressable>
        ) : null}
        {submitted && invalid ? (
          <Text variant="small" color={status.late.fg}>
            {invalid}
          </Text>
        ) : null}
      </ScrollView>
      {!readOnly ? (
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
          <FormError message={error} />
          <Button
            label={saving ? 'Enregistrement…' : expense ? 'Enregistrer les modifications' : 'Enregistrer la dépense'}
            icon={Check}
            haptic
            onPress={save}
            disabled={saving}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
