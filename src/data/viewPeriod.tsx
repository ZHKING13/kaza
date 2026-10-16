import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { useStore } from './store';

type ViewPeriod = {
  /** Mois affiché sur l'Accueil, les Locataires et la fiche du bien, "YYYY-MM" */
  period: string;
  /** Mois en cours */
  current: string;
  setPeriod: (period: string) => void;
};

const ViewPeriodContext = createContext<ViewPeriod | null>(null);

/** Mois consulté, partagé entre les écrans ; suit le mois en cours tant qu'on n'en a pas choisi un autre. */
export function ViewPeriodProvider({ children }: { children: ReactNode }) {
  const { period: current, organizationId } = useStore();
  const [chosen, setChosen] = useState<{ period: string; org: string | null } | null>(null);
  const value = useMemo<ViewPeriod>(
    () => ({
      // Le choix ne survit pas à un changement d'espace
      period: chosen && chosen.org === organizationId ? chosen.period : current,
      current,
      setPeriod: (period) => setChosen(period === current ? null : { period, org: organizationId }),
    }),
    [chosen, current, organizationId],
  );
  return <ViewPeriodContext.Provider value={value}>{children}</ViewPeriodContext.Provider>;
}

export function useViewPeriod(): ViewPeriod {
  const v = useContext(ViewPeriodContext);
  if (!v) throw new Error('useViewPeriod must be used inside <ViewPeriodProvider>');
  return v;
}
