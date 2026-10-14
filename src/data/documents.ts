import { receiptHtml, settlementHtml, slug } from '@/lib/documents';
import { formatPeriod } from '@/lib/format';

import { rentForPeriod } from './prorata';
import { tenantRent } from './rent';
import { useStore } from './store';

/** Données nécessaires pour la quittance d'un paiement, ou `undefined` si le paiement n'existe plus. */
export function useReceipt(paymentId: string) {
  const { payments, tenants, units, properties, profile, settings } = useStore();
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) return undefined;
  const tenant = tenants.find((t) => t.id === payment.tenantId)!;
  const unit = units.find((u) => u.id === tenant.unitId)!;
  const property = properties.find((p) => p.id === unit.propertyId)!;
  const dueForPeriod = rentForPeriod(tenantRent(tenant, unit), payment.period, settings.prorata, tenant.entryDate, tenant.exitDate).amount;
  // Total reçu pour la période jusqu'à ce paiement inclus
  const paidForPeriod = payments
    .filter((p) => p.tenantId === tenant.id && p.period === payment.period && p.date <= payment.date)
    .reduce((s, p) => s + p.amount, 0);
  const args = { payment, paidForPeriod, dueForPeriod, tenant, unit, property, profile };
  const full = paidForPeriod >= dueForPeriod;
  return {
    ...args,
    full,
    html: () => receiptHtml(args),
    fileName: slug(full ? 'Quittance' : 'Recu', tenant.firstName, tenant.lastName, formatPeriod(payment.period)),
  };
}

/** Données du solde de tout compte d'un ancien locataire. */
export function useSettlementDoc(tenantId: string) {
  const { tenants, units, properties, profile } = useStore();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant?.settlement || !tenant.exitDate) return undefined;
  const unit = units.find((u) => u.id === tenant.unitId)!;
  const property = properties.find((p) => p.id === unit.propertyId)!;
  const args = { settlement: tenant.settlement, exitDate: tenant.exitDate, tenant, unit, property, profile };
  return { html: () => settlementHtml(args), fileName: slug('Solde-de-tout-compte', tenant.firstName, tenant.lastName) };
}
