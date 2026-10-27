import { router, Stack } from 'expo-router';
import { FileSpreadsheet, FileText, Lock, MessageCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { FormError } from '@/components/FormError';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { Text } from '@/components/Text';
import { addMonthsToPeriod } from '@/data/rent';
import { usePlan, useReport, useStore } from '@/data/store';
import { slug } from '@/lib/documents';
import { shareBytes, XLSX_MIME } from '@/lib/files';
import { formatAmount } from '@/lib/format';
import { sharePdf } from '@/lib/pdf';
import { landlordStatementHtml, landlordSummaryText, periodLabel, type ReportData, reportSheets, statementHtml } from '@/lib/reports';
import { openWhatsApp } from '@/lib/whatsapp';
import { buildXlsx } from '@/lib/xlsx';
import { radius, space, useTheme } from '@/theme';

type Kind = 'releve' | 'proprietaire';
type Range = 'month' | 'last' | 'quarter' | 'year' | 'lastYear';

const RANGES: { key: Range; label: string }[] = [
  { key: 'month', label: 'Ce mois' },
  { key: 'last', label: 'Mois dernier' },
  { key: 'quarter', label: '3 derniers mois' },
  { key: 'year', label: 'Cette année' },
  { key: 'lastYear', label: 'Année dernière' },
];

function rangeOf(range: Range, period: string): [string, string] {
  const year = Number(period.slice(0, 4));
  switch (range) {
    case 'month':
      return [period, period];
    case 'last':
      return [addMonthsToPeriod(period, -1), addMonthsToPeriod(period, -1)];
    case 'quarter':
      return [addMonthsToPeriod(period, -2), period];
    case 'year':
      return [`${year}-01`, period];
    case 'lastYear':
      return [`${year - 1}-01`, `${year - 1}-12`];
  }
}

/** Plus › Rapports et exports : relevé de gestion (PDF, Excel) et compte rendu par propriétaire du bien. */
export default function Rapports() {
  const { c } = useTheme();
  const store = useStore();
  const { period, properties, profile, identity } = store;
  const { limits } = usePlan();
  const [kind, setKind] = useState<Kind>('releve');
  const [range, setRange] = useState<Range>('last');
  const [chosen, setChosen] = useState<string[] | null>(null);
  const landlords = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string; propertyIds: string[] }>();
    for (const p of properties) {
      if (!p.landlordName) continue;
      const key = p.landlordName.trim().toLowerCase();
      const entry = map.get(key) ?? { name: p.landlordName.trim(), phone: p.landlordPhone, propertyIds: [] };
      entry.propertyIds.push(p.id);
      entry.phone ??= p.landlordPhone;
      map.set(key, entry);
    }
    return [...map.values()];
  }, [properties]);
  const [landlordKey, setLandlordKey] = useState<string | null>(null);
  const landlord = landlords.find((l) => l.name === landlordKey) ?? landlords[0];
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const [from, to] = rangeOf(range, period);
  const ids = kind === 'proprietaire' ? (landlord?.propertyIds ?? []) : (chosen ?? undefined);
  const report = useReport(from, to, ids);
  const t = report.totals;
  const data: ReportData = {
    report,
    identity,
    profile,
    properties: store.properties,
    units: store.units,
    tenants: store.tenants,
    payments: store.payments,
    expenses: store.expenses,
  };
  const label = periodLabel(from, to);
  const managerName = identity.legalName || `${profile.firstName} ${profile.lastName}`.trim();
  const locked = kind === 'proprietaire' && !limits.landlordReports;

  const run = async (what: string, job: () => Promise<void>) => {
    setBusy(what);
    setError(undefined);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error && e.message === 'popup' ? 'Autorisez les fenêtres pour ce site, puis réessayez.' : 'Le document n’a pas pu être créé. Réessayez.');
    } finally {
      setBusy(undefined);
    }
  };
  const pdf = () =>
    run('pdf', () =>
      kind === 'proprietaire' && landlord
        ? sharePdf(landlordStatementHtml(data, landlord), slug('Compte-rendu', landlord.name, label))
        : sharePdf(statementHtml(data), slug('Releve', label)),
    );
  const excel = () =>
    run('xlsx', () => shareBytes(buildXlsx(reportSheets(data)), `${slug(kind === 'proprietaire' && landlord ? `Compte-rendu ${landlord.name}` : 'Releve', label)}.xlsx`, XLSX_MIME));

  const toggle = (id: string) => {
    const all = properties.map((p) => p.id);
    const current = chosen ?? all;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setChosen(next.length === 0 || next.length === all.length ? null : next);
  };

  const row = (name: string, value: number, strong = false, negative = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text variant={strong ? 'bodyStrong' : 'body'}>{name}</Text>
      <Text variant={strong ? 'bodyStrong' : 'body'} style={{ fontVariant: ['tabular-nums'] }}>
        {negative && value ? '− ' : ''}
        {formatAmount(value)}
      </Text>
    </View>
  );

  const lockedCard = (text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
      <Lock size={18} color={c.textMuted} />
      <Text variant="small" style={{ flex: 1 }}>
        {text}
      </Text>
      <Button label="Voir les offres" variant="ghost" compact onPress={() => router.push('/offre')} />
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl }}>
      <Stack.Screen options={{ title: 'Rapports et exports' }} />
      <SegmentedTabs
        tabs={[
          { key: 'releve', label: 'Relevé de gestion' },
          { key: 'proprietaire', label: 'Par propriétaire' },
        ]}
        value={kind}
        onChange={setKind}
      />

      <View style={{ gap: 6 }}>
        <Text variant="label" tone="muted">
          Période
        </Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {RANGES.map((r) => (
            <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />
          ))}
        </View>
      </View>

      {kind === 'releve' ? (
        properties.length > 1 ? (
          <View style={{ gap: 6 }}>
            <Text variant="label" tone="muted">
              Biens
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              <Chip label="Tous" selected={!chosen} onPress={() => setChosen(null)} />
              {properties.map((p) => (
                <Chip key={p.id} label={p.name} selected={!!chosen?.includes(p.id)} onPress={() => toggle(p.id)} />
              ))}
            </View>
          </View>
        ) : null
      ) : landlords.length ? (
        <View style={{ gap: 6 }}>
          <Text variant="label" tone="muted">
            Propriétaire
          </Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {landlords.map((l) => (
              <Chip
                key={l.name}
                label={`${l.name} · ${l.propertyIds.length} bien${l.propertyIds.length > 1 ? 's' : ''}`}
                selected={landlord?.name === l.name}
                onPress={() => setLandlordKey(l.name)}
              />
            ))}
          </View>
        </View>
      ) : (
        <Card>
          <Text variant="bodyStrong">Aucun bien géré pour un propriétaire</Text>
          <Text variant="small" tone="muted">
            Sur la fiche d’un bien, indiquez son propriétaire et votre commission : vous pourrez lui envoyer un compte rendu de gestion
            chaque mois (loyers encaissés, commission, dépenses, montant à reverser).
          </Text>
        </Card>
      )}

      {kind === 'releve' || landlord ? (
        <Card style={{ gap: 2 }}>
          <Text variant="caption" tone="muted" style={{ textTransform: 'capitalize' }}>
            {label}
            {kind === 'proprietaire' && landlord ? ` · ${landlord.name}` : ''}
          </Text>
          {row('Loyers dus', t.expected)}
          {row('Loyers encaissés', t.collected)}
          {row('Reste dû par les locataires', t.outstanding)}
          {kind === 'proprietaire' ? row('Commission', t.commission, false, true) : null}
          {row('Dépenses', t.expenses, false, true)}
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />
          {kind === 'proprietaire' ? row('Montant dû au propriétaire', t.dueToLandlord, true) : row('Net (encaissé − dépenses)', t.net, true)}
          {kind === 'releve' && report.properties.length > 1 ? (
            <View style={{ marginTop: space.sm, gap: 2 }}>
              {report.properties.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', gap: space.sm }}>
                  <Text variant="small" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="small" style={{ fontVariant: ['tabular-nums'] }}>
                    net {formatAmount(p.totals.net)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {locked ? (
        lockedCard('Le compte rendu par propriétaire est compris dans l’offre Agence.')
      ) : kind === 'releve' || landlord ? (
        <View style={{ gap: space.xs }}>
          <Button label={busy === 'pdf' ? 'Préparation…' : 'Partager le PDF'} icon={FileText} onPress={pdf} disabled={!!busy} />
          {limits.exports ? (
            <Button
              label={busy === 'xlsx' ? 'Préparation…' : 'Exporter en Excel'}
              icon={FileSpreadsheet}
              variant="secondary"
              onPress={excel}
              disabled={!!busy}
            />
          ) : (
            lockedCard('L’export Excel est compris à partir de l’offre Famille.')
          )}
          {kind === 'proprietaire' && landlord?.phone ? (
            <Button
              label={`Résumé à ${landlord.name} par WhatsApp`}
              icon={MessageCircle}
              variant="ghost"
              onPress={() => openWhatsApp(landlord.phone!, landlordSummaryText(report, landlord.name, managerName))}
            />
          ) : null}
        </View>
      ) : null}
      <FormError message={error} />
      <Text variant="caption" tone="muted">
        Les loyers comptent pour le mois qu’ils règlent, les dépenses pour le mois de leur date. Calculés sur ce téléphone, même hors
        connexion.
      </Text>
    </ScrollView>
  );
}
