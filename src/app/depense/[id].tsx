import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ban, Receipt, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ExpenseForm } from '@/components/ExpenseForm';
import { FormError } from '@/components/FormError';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { expenseCategories } from '@/data/expenses';
import { usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatAmount } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

/** Dépense : modification, justificatif, annulation ; dépense mensuelle à arrêter. */
export default function Depense() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, expenseSchedules, voidExpense, stopExpenseSchedule } = useStore();
  const { canManage } = usePermissions();
  const expense = expenses.find((e) => e.id === id);
  const schedule = expense?.scheduleId ? expenseSchedules.find((s) => s.id === expense.scheduleId) : undefined;
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  if (!expense) return <EmptyState icon={Receipt} title="Dépense introuvable" body="Elle a peut-être été annulée." />;

  const confirmVoid = async () => {
    if (!reason.trim()) return setError('Indiquez le motif de l’annulation.');
    setError(undefined);
    try {
      await voidExpense(expense.id, reason.trim());
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const stop = async () => {
    setError(undefined);
    try {
      await stopExpenseSchedule(schedule!.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: expenseCategories[expense.category].label }} />
      {canManage ? (
        <View style={{ padding: space.md, paddingBottom: 0, gap: space.xs }}>
          {schedule ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.primarySoft }}>
              <Repeat size={18} color={c.primary} />
              <Text variant="small" style={{ flex: 1 }}>
                Revient chaque mois le {schedule.dayOfMonth} ({formatAmount(schedule.amount)}).
              </Text>
              <Button label="Arrêter" variant="ghost" compact onPress={stop} />
            </View>
          ) : null}
          {voiding ? (
            <View style={{ gap: space.xs, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}>
              <TextField label="Motif de l’annulation" value={reason} onChangeText={setReason} placeholder="Saisie en double" maxLength={200} />
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <Button label="Annuler la dépense" variant="danger" compact onPress={confirmVoid} />
                <Button label="Garder" variant="ghost" compact onPress={() => setVoiding(false)} />
              </View>
            </View>
          ) : (
            <Button label="Annuler cette dépense" icon={Ban} variant="ghost" compact onPress={() => setVoiding(true)} />
          )}
          <FormError message={error} />
        </View>
      ) : null}
      <ExpenseForm propertyId={expense.propertyId} expense={expense} readOnly={!canManage} />
    </View>
  );
}
