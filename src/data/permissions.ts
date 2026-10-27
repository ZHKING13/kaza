/**
 * Permissions des collaborateurs : copie de `permissions.ts` de @zhking13/kaza-domain 0.11.1 (le serveur vérifie ;
 * l'application cache ce qui serait refusé). Voir les loyers, les retards et les locataires n'est pas une permission :
 * tout membre les voit.
 */
import type { Role } from './remote';

export const permissions = [
  'payments.record',
  'payments.void',
  'messages.send',
  'leases.manage',
  'properties.manage',
  'expenses.manage',
  'reports.view',
  'activity.view',
] as const;
export type Permission = (typeof permissions)[number];
export type PermissionPreset = Exclude<Role, 'owner'>;

/** Modèles : les droits des rôles d'avant, à l'identique */
export const rolePresets: Record<PermissionPreset, Permission[]> = {
  manager: [...permissions],
  collector: ['payments.record', 'messages.send', 'reports.view'],
  viewer: ['reports.view'],
};

export const permissionLabels: Record<Permission, { label: string; hint: string }> = {
  'payments.record': { label: 'Noter un paiement', hint: 'Encaisser, confirmer ou refuser un paiement signalé' },
  'payments.void': { label: 'Annuler un paiement', hint: 'Toujours avec un motif, gardé au journal' },
  'messages.send': { label: 'Relancer un locataire', hint: 'Relances, quittances et liens de paiement' },
  'leases.manage': { label: 'Gérer les locataires et les baux', hint: 'Nouveau bail, préavis, révision, départ' },
  'properties.manage': { label: 'Gérer les biens et les logements', hint: 'Ajouter, modifier, photos' },
  'expenses.manage': { label: 'Noter une dépense', hint: 'Dépenses et dépenses mensuelles' },
  'reports.view': { label: 'Voir les rapports et exporter', hint: 'Relevés, comptes rendus, Excel' },
  'activity.view': { label: 'Voir le journal d’activité', hint: 'Et les invitations en attente' },
};

/**
 * Permissions en vigueur ; sans liste reçue du serveur, celles du modèle du rôle. Limité à certains biens, pas de
 * journal : il couvre tout l'espace.
 */
export function memberPermissions(
  role: Role,
  list?: readonly string[] | null,
  propertyIds?: readonly string[] | null,
): Permission[] {
  if (role === 'owner') return [...permissions];
  const granted = new Set(list ?? rolePresets[role]);
  if (propertyIds?.length) granted.delete('activity.view');
  return permissions.filter((p) => granted.has(p));
}

/** Modèle qui correspond exactement à ces permissions, sinon null (« personnalisé ») */
export function presetOf(list: readonly string[]): PermissionPreset | null {
  const key = memberPermissions('viewer', list).join();
  return (Object.keys(rolePresets) as PermissionPreset[]).find((r) => rolePresets[r].join() === key) ?? null;
}
