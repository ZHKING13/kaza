/**
 * Offres de Kaza : mêmes valeurs que `plans` de @zhking13/kaza-domain 0.9.0 (le serveur applique les
 * limites ; l'application les affiche).
 */
export type PlanId = 'free' | 'starter' | 'family' | 'pro' | 'agency';

export type PlanLimits = {
  units: number | null;
  members: number | null;
  messagesPerMonth: number;
  onlinePayments: boolean;
  branding: boolean;
  activityLog: boolean;
  /** Export Excel des rapports (le relevé PDF est compris partout) */
  exports: boolean;
  /** Compte rendu de gestion par propriétaire du bien (mandant) */
  landlordReports: boolean;
};

export const plans: Record<PlanId, { label: string; monthlyPrice: number; limits: PlanLimits; pitch: string }> = {
  free: {
    label: 'Gratuit',
    monthlyPrice: 0,
    pitch: 'Pour essayer avec quelques logements.',
    limits: { units: 3, members: 1, messagesPerMonth: 5, onlinePayments: false, branding: false, activityLog: false, exports: false, landlordReports: false },
  },
  starter: {
    label: 'Bailleur',
    monthlyPrice: 3000,
    pitch: 'Le bailleur seul : Kaza relance et envoie vos quittances à votre place.',
    limits: { units: 10, members: 1, messagesPerMonth: 60, onlinePayments: true, branding: false, activityLog: false, exports: true, landlordReports: false },
  },
  family: {
    label: 'Famille',
    monthlyPrice: 5000,
    pitch: 'Un proche ou un collecteur encaisse sur place, vous suivez tout de loin.',
    limits: { units: 10, members: 2, messagesPerMonth: 60, onlinePayments: true, branding: false, activityLog: true, exports: true, landlordReports: false },
  },
  pro: {
    label: 'Pro',
    monthlyPrice: 8000,
    pitch: 'Avec un gérant ou un collecteur, et vos quittances à vos couleurs.',
    limits: { units: 40, members: 3, messagesPerMonth: 250, onlinePayments: true, branding: true, activityLog: true, exports: true, landlordReports: true },
  },
  agency: {
    label: 'Agence',
    monthlyPrice: 25000,
    pitch: 'Pour les agences : équipe sans limite, 150 logements.',
    limits: { units: 150, members: null, messagesPerMonth: 1000, onlinePayments: true, branding: true, activityLog: true, exports: true, landlordReports: true },
  },
};

export const paidPlans: PlanId[] = ['starter', 'family', 'pro', 'agency'];
export const billingMonths = [1, 3, 12] as const;
export type BillingMonths = (typeof billingMonths)[number];

/** 12 mois au prix de 10 */
export function planPrice(plan: PlanId, months: BillingMonths): number {
  const monthly = plans[plan].monthlyPrice;
  return months === 12 ? monthly * 10 : monthly * months;
}

export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'expired' | 'free';

/** Offre en vigueur, telle que le serveur la renvoie avec l'espace */
export type OrganizationSubscription = {
  plan: PlanId;
  status: SubscriptionStatus;
  effectivePlan: PlanId;
  endsAt: string | null;
  daysLeft: number | null;
};

export const statusLabels: Record<SubscriptionStatus, string> = {
  trial: 'Essai',
  active: 'Active',
  grace: 'À renouveler',
  expired: 'Terminée',
  free: 'Gratuite',
};

/** Offre de bienvenue (copie de @zhking13/kaza-domain 0.9.0) : réduction sur le premier paiement, 30 jours après l'inscription. */
export const welcomeOffer = {
  days: 30,
  percentByMonths: { 3: 25, 12: 20 } as Partial<Record<BillingMonths, number>>,
};
