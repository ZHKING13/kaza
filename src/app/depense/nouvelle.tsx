import { Stack, useLocalSearchParams } from 'expo-router';
import { Receipt } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { ExpenseForm } from '@/components/ExpenseForm';
import { usePermissions, useStore } from '@/data/store';

/** « Ajouter une dépense » depuis la fiche d'un bien. */
export default function NouvelleDepense() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { properties } = useStore();
  const { can } = usePermissions();
  const canManage = can('expenses.manage');
  const property = properties.find((p) => p.id === propertyId);
  if (!property || !canManage) {
    return <EmptyState icon={Receipt} title="Dépense impossible" body="Ce bien n’existe plus, ou votre rôle ne le permet pas." />;
  }
  return (
    <>
      <Stack.Screen options={{ title: `Dépense · ${property.name}` }} />
      <ExpenseForm propertyId={property.id} />
    </>
  );
}
