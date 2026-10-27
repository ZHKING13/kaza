import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ban, Receipt, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState } from '@/components/EmptyState';
import { ExpenseForm } from '@/components/ExpenseForm';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { expenseCategories } from '@/data/expenses';
import { usePermissions, useStore } from '@/data/store';
import { formatAmount } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

/** Dépense : modification, justificatif, annulation ; dépense mensuelle à arrêter. */
export default function Depense() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, expenseSchedules, voidExpense, stopExpenseSchedule } = useStore();
  const { can } = usePermissions();
  const canManage = can('expenses.manage');
  const expense = expenses.find((e) => e.id === id);
  const schedule = expense?.scheduleId ? expenseSchedules.find((s) => s.id === expense.scheduleId) : undefined;
  const [voiding, setVoiding] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [reason, setReason] = useState('');

  if (!expense) return <EmptyState icon={Receipt} title="Dépense introuvable" body="Elle a peut-être été annulée." />;

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
              <Button label="Arrêter" variant="ghost" compact onPress={() => setStopping(true)} />
            </View>
          ) : null}
          <Button label="Annuler cette dépense" icon={Ban} variant="ghost" compact onPress={() => setVoiding(true)} />
        </View>
      ) : null}
      <ConfirmSheet
        visible={voiding}
        title="Annuler cette dépense ?"
        message={`${formatAmount(expense.amount)} · ${expenseCategories[expense.category].label}. Elle ne comptera plus dans les rapports ; l’annulation et son motif restent dans l’historique.`}
        confirmLabel="Annuler la dépense"
        cancelLabel="Garder la dépense"
        onClose={() => setVoiding(false)}
        onConfirm={async () => {
          if (!reason.trim()) throw new Error('Indiquez le motif de l’annulation.');
          await voidExpense(expense.id, reason.trim());
          router.back();
        }}>
        <TextField label="Motif de l’annulation" value={reason} onChangeText={setReason} placeholder="Saisie en double" maxLength={200} />
      </ConfirmSheet>
      {schedule ? (
        <ConfirmSheet
          visible={stopping}
          title="Arrêter cette dépense mensuelle ?"
          message={`Kaza n’ajoutera plus ${formatAmount(schedule.amount)} chaque mois. Les mois déjà enregistrés restent.`}
          confirmLabel="Arrêter chaque mois"
          onClose={() => setStopping(false)}
          onConfirm={() => stopExpenseSchedule(schedule.id)}
        />
      ) : null}
      <ExpenseForm propertyId={expense.propertyId} expense={expense} readOnly={!canManage} />
    </View>
  );
}
