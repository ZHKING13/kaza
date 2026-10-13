import { Building2, Fence, House, type LucideIcon, Store } from 'lucide-react-native';

import type { PropertyType } from './types';

export const propertyTypes: Record<
  PropertyType,
  { label: string; hint: string; icon: LucideIcon; singleUnit: boolean; defaultUnit: string }
> = {
  cour: { label: 'Cour commune', hint: 'Chambres et studios autour d’une cour', icon: Fence, singleUnit: false, defaultUnit: 'Chambre 1' },
  immeuble: { label: 'Immeuble', hint: 'Plusieurs appartements', icon: Building2, singleUnit: false, defaultUnit: 'Appt 1' },
  villa: { label: 'Villa ou maison', hint: 'Louée en entier', icon: House, singleUnit: true, defaultUnit: 'Maison' },
  magasin: { label: 'Magasin ou local', hint: 'Commerce, bureau', icon: Store, singleUnit: true, defaultUnit: 'Local' },
};

export const propertyTypeOrder: PropertyType[] = ['cour', 'immeuble', 'villa', 'magasin'];
