import type { ExpenseCategory, ExpenseMethod } from './types';

/** Mêmes catégories que `expenseCategories` de @zhking13/kaza-domain 0.7.0. */
export const expenseCategories: Record<ExpenseCategory, { label: string; short: string }> = {
  works: { label: 'Travaux et réparations', short: 'Travaux' },
  maintenance: { label: 'Entretien', short: 'Entretien' },
  utilities: { label: 'Eau, électricité, charges', short: 'Charges' },
  taxes: { label: 'Impôt foncier et taxes', short: 'Impôts' },
  insurance: { label: 'Assurance', short: 'Assurance' },
  caretaker: { label: 'Gardiennage', short: 'Gardien' },
  agency_fees: { label: 'Frais d’agence', short: 'Agence' },
  other: { label: 'Autre', short: 'Autre' },
};

export const expenseCategoryIds = Object.keys(expenseCategories) as ExpenseCategory[];

export const expenseMethods: Record<ExpenseMethod, { label: string }> = {
  cash: { label: 'Espèces' },
  mobile_money: { label: 'Mobile money' },
  bank: { label: 'Virement' },
  cheque: { label: 'Chèque' },
};

export const expenseMethodIds = Object.keys(expenseMethods) as ExpenseMethod[];

/** 750 points de base → « 7,5 % » */
export function formatRate(bps: number): string {
  return `${(bps / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}
