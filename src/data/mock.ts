import { periodOf } from '@/lib/format';

import type { Unit, Payment, PaymentMethod, Property, Tenant } from './types';

/** Données d'exemple : 3 biens à Abidjan, 19 unités, 17 locataires. */

export const properties: Property[] = [
  { id: 'p1', name: 'Résidence Les Palmiers', type: 'immeuble', district: 'Cocody Angré', city: 'Abidjan' },
  { id: 'p2', name: 'Cour commune Yopougon', type: 'cour', district: 'Yopougon Selmer', city: 'Abidjan' },
  { id: 'p3', name: 'Immeuble Marcory', type: 'immeuble', district: 'Marcory Zone 4', city: 'Abidjan' },
];

const unit = (id: string, propertyId: string, label: string, rent: number): Unit => ({ id, propertyId, label, rent });

export const units: Unit[] = [
  unit('l1', 'p1', 'A1', 150000),
  unit('l2', 'p1', 'A2', 150000),
  unit('l3', 'p1', 'B1', 120000),
  unit('l4', 'p1', 'B2', 85000),
  unit('l5', 'p1', 'C4', 120000),
  unit('l6', 'p1', 'C5', 120000),
  unit('l7', 'p2', 'Chambre 1', 35000),
  unit('l8', 'p2', 'Chambre 2', 35000),
  unit('l9', 'p2', 'Chambre 3', 40000),
  unit('l10', 'p2', 'Chambre 4', 40000),
  unit('l11', 'p2', 'Chambre 5', 35000),
  unit('l12', 'p2', 'Studio 6', 60000),
  unit('l13', 'p2', 'Studio 7', 60000),
  unit('l14', 'p3', 'Appt 1', 180000),
  unit('l15', 'p3', 'Appt 2', 180000),
  unit('l16', 'p3', 'Appt 3', 200000),
  unit('l17', 'p3', 'Appt 4', 200000),
  unit('l18', 'p3', 'Magasin', 100000),
  unit('l19', 'p3', 'Appt 5', 180000),
];

const t = (
  id: string,
  firstName: string,
  lastName: string,
  phone: string,
  unitId: string,
  dueDay = 5,
  advanceMonthsLeft = 0,
): Tenant => ({ id, firstName, lastName, phone, unitId, dueDay, advanceMonthsLeft, depositMonths: 2 });

// Les unités l12 et l19 sont vacantes.
export const tenants: Tenant[] = [
  t('t1', 'Awa', 'Koné', '+2250712345678', 'l4', 5, 2),
  t('t2', 'Yao', 'Touré', '+2250501020304', 'l1'),
  t('t3', 'Mariam', 'Diallo', '+2250707080910', 'l5'),
  t('t4', 'Ibrahim', 'Ouattara', '+2250102030405', 'l2', 10),
  t('t5', 'Fatou', 'Ndiaye', '+2250708091011', 'l3'),
  t('t6', 'Koffi', 'Kouassi', '+2250506070809', 'l6', 15),
  t('t7', 'Adjoua', 'Yao', '+2250101010101', 'l7'),
  t('t8', 'Seydou', 'Traoré', '+2250777665544', 'l8'),
  t('t9', 'Aminata', 'Coulibaly', '+2250544332211', 'l9'),
  t('t10', 'Jean-Marc', 'Gbagbo', '+2250199887766', 'l10'),
  t('t11', 'Salimata', 'Bamba', '+2250722113344', 'l11', 10),
  t('t12', 'Didier', 'Ehui', '+2250566778899', 'l13'),
  t('t13', 'Christelle', 'Aka', '+2250733445566', 'l14', 5, 1),
  t('t14', 'Moussa', 'Sangaré', '+2250588990011', 'l15'),
  t('t15', 'Grâce', 'N’Guessan', '+2250144556677', 'l16', 15),
  t('t16', 'Ousmane', 'Cissé', '+2250799001122', 'l17'),
  t('t17', 'Boutique', 'Chez Tanti', '+2250511223344', 'l18', 10),
];

function day(base: Date, monthOffset: number, d: number): string {
  return new Date(base.getFullYear(), base.getMonth() + monthOffset, d, 10, 30).toISOString();
}

/** Génère l'historique de paiement relatif au mois en cours. */
export function buildPayments(today: Date): Payment[] {
  const out: Payment[] = [];
  const rentOf = (tenantId: string) => {
    const tenant = tenants.find((x) => x.id === tenantId)!;
    return units.find((l) => l.id === tenant.unitId)!.rent;
  };
  const add = (tenantId: string, monthOffset: number, d: number, method: PaymentMethod, ratio = 1) => {
    const date = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    out.push({
      id: `pay-${tenantId}-${monthOffset}-${out.length}`,
      tenantId,
      amount: Math.round(rentOf(tenantId) * ratio),
      method,
      date: day(today, monthOffset, d),
      period: periodOf(date),
    });
  };

  // Mois précédents : presque tout le monde a payé
  const methodsCycle: PaymentMethod[] = ['wave', 'orange', 'cash', 'mtn', 'wave', 'moov'];
  tenants.forEach((tn, i) => {
    add(tn.id, -2, 3 + (i % 6), methodsCycle[i % methodsCycle.length]);
    if (tn.id !== 't3') add(tn.id, -1, 2 + (i % 7), methodsCycle[(i + 1) % methodsCycle.length]);
  });

  // Mois en cours (jusqu'à aujourd'hui)
  const d = (n: number) => Math.min(n, today.getDate());
  add('t1', 0, d(3), 'wave');
  add('t2', 0, d(4), 'orange', 40000 / 150000);
  add('t4', 0, d(2), 'mtn');
  add('t5', 0, d(5), 'cash');
  add('t7', 0, d(1), 'cash');
  add('t9', 0, d(4), 'wave');
  add('t11', 0, d(6), 'orange');
  add('t12', 0, d(3), 'moov');
  add('t13', 0, d(2), 'wave');
  add('t14', 0, d(5), 'wave');
  add('t16', 0, d(4), 'orange');
  add('t17', 0, d(7), 'cash', 0.5);

  return out.sort((a, b) => b.date.localeCompare(a.date));
}
