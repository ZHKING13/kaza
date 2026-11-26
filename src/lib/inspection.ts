import type { Identity, Profile } from '@/data/store';
import type {
  Inspection,
  InspectionCondition,
  InspectionItem,
  InspectionKind,
  InspectionRoom,
  Property,
  PropertyType,
  Tenant,
  Unit,
} from '@/data/types';

import { branding, esc, header, page, slug } from './documents';
import { formatAmount, formatDateLong as formatDate } from './format';

/** État des lieux d'entrée et de sortie : pièces proposées selon le type de logement, PDF avec photos et signatures. */

export const conditionLabels: Record<InspectionCondition, string> = {
  new: 'Neuf',
  good: 'Bon',
  worn: 'Usagé',
  bad: 'Mauvais',
  missing: 'Absent',
};
export const conditionOrder: InspectionCondition[] = ['new', 'good', 'worn', 'bad', 'missing'];

/** Vrai si l'élément s'est dégradé depuis l'entrée (Bon → Usagé, Usagé → Mauvais…). */
export const worse = (entry: InspectionCondition | null | undefined, exit: InspectionCondition | null | undefined) =>
  !!entry && !!exit && conditionOrder.indexOf(exit) > conditionOrder.indexOf(entry);

const BASE = ['Murs et peinture', 'Sol', 'Plafond', 'Portes et serrures', 'Fenêtres et moustiquaires', 'Prises et éclairage'];
const WET = ['Robinetterie', 'Lavabo, douche, WC', 'Évacuations'];
const KITCHEN = ['Évier', 'Placards', 'Plan de travail'];

const roomsByType: Record<PropertyType, [string, string[]][]> = {
  cour: [
    ['Pièce principale', BASE],
    ['Douche / WC', [...BASE.slice(0, 2), 'Portes et serrures', ...WET]],
    ['Cour / terrasse', ['Sol', 'Portail', 'Éclairage extérieur']],
  ],
  immeuble: [
    ['Séjour', BASE],
    ['Chambre 1', BASE],
    ['Cuisine', [...BASE, ...KITCHEN]],
    ['Salle d’eau', [...BASE.slice(0, 2), 'Portes et serrures', ...WET]],
    ['Balcon', ['Sol', 'Garde-corps']],
  ],
  villa: [
    ['Séjour', BASE],
    ['Chambre 1', BASE],
    ['Chambre 2', BASE],
    ['Cuisine', [...BASE, ...KITCHEN]],
    ['Salle d’eau', [...BASE.slice(0, 2), 'Portes et serrures', ...WET]],
    ['Cour / jardin', ['Sol', 'Portail', 'Clôture', 'Éclairage extérieur']],
  ],
  magasin: [
    ['Local', [...BASE, 'Rideau métallique']],
    ['Arrière-boutique', BASE],
    ['Toilettes', [...BASE.slice(0, 2), 'Portes et serrures', ...WET]],
  ],
};

const itemId = (label: string, i: number) => `${slug(label).toLowerCase().slice(0, 30)}-${i}`;

export const newItem = (label: string, i: number): InspectionItem => ({ id: itemId(label, i), label, condition: null, comment: null, photoIds: [] });

export const newRoom = (name: string, labels: string[], i: number): InspectionRoom => ({
  id: `${slug(name).toLowerCase().slice(0, 30)}-${i}`,
  name,
  items: labels.map(newItem),
});

/**
 * Nouvel état des lieux. Sortie : mêmes pièces et éléments que l'entrée (pour comparer élément par élément), états à
 * refaire ; sinon, pièces proposées selon le type de logement.
 */
export function newInspection(id: string, kind: InspectionKind, type: PropertyType, date: string, entry?: Inspection): Inspection {
  const rooms = entry
    ? entry.rooms.map((r) => ({ ...r, items: r.items.map((it) => ({ ...it, condition: null, comment: null, photoIds: [] })) }))
    : roomsByType[type].map(([name, labels], i) => newRoom(name, labels, i));
  return {
    id,
    kind,
    date,
    rooms,
    meters: { electricity: null, water: null },
    keys: { unit: entry?.keys.unit ?? null, gate: entry?.keys.gate ?? null, other: null },
    observations: null,
    deductions: [],
    landlordSignature: null,
    tenantSignature: null,
    signedAt: null,
    photos: [],
  };
}

/** Éléments renseignés / total, pour la fiche du locataire. */
export function progress(inspection: Inspection) {
  const items = inspection.rooms.flatMap((r) => r.items);
  return { done: items.filter((i) => i.condition).length, total: items.length };
}

type Args = {
  identity?: Identity;
  profile: Profile;
  tenant: Tenant;
  unit: Unit;
  property: Property;
  inspection: Inspection;
  /** Sortie : l'état des lieux d'entrée, pour la colonne « Entrée » */
  entry?: Inspection;
};

const signatureSvg = (path: string | null) =>
  path
    ? `<svg viewBox="0 0 320 140" width="200" height="88" style="display:block"><path d="${esc(path)}" fill="none" stroke="#0F172A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : '<div style="height:88px"></div>';

/** PDF de l'état des lieux, avec les photos (liens du serveur, ou images du téléphone pas encore envoyées). */
export function inspectionHtml({ identity, profile, tenant, unit, property, inspection, entry }: Args) {
  const brand = branding(identity, profile);
  const exit = inspection.kind === 'exit';
  const title = exit ? 'État des lieux de sortie' : 'État des lieux d’entrée';
  const photoUrl = new Map(inspection.photos.map((p) => [p.id, p.url]));
  const entryItem = (roomId: string, id: string) => entry?.rooms.find((r) => r.id === roomId)?.items.find((i) => i.id === id);
  const photos = (ids: string[]) =>
    ids
      .map((id) => photoUrl.get(id))
      .filter((u): u is string => !!u)
      .map((u) => `<img src="${esc(u)}" style="width:110px;height:82px;object-fit:cover;border-radius:4px;margin:4px 4px 0 0">`)
      .join('');
  const meter = (label: string, m: Inspection['meters']['electricity']) =>
    `<tr><td>${esc(label)}</td><td class="v">${m?.number ? esc(m.number) : '—'}</td><td class="v">${m?.index ? esc(m.index) : '—'}</td></tr>${
      m?.photoId && photoUrl.get(m.photoId) ? `<tr><td colspan="3">${photos([m.photoId])}</td></tr>` : ''
    }`;
  const rooms = inspection.rooms
    .map(
      (r) => `<div class="avoid"><h2>${esc(r.name)}</h2><table class="grid" style="table-layout:fixed"><colgroup><col style="width:34%">${exit ? '<col style="width:13%">' : ''}<col style="width:13%"><col></colgroup><tr><th>Élément</th>${exit ? '<th class="l">Entrée</th>' : ''}<th class="l">État</th><th class="l">Commentaire</th></tr>${r.items
        .map((it) => {
          const before = exit ? entryItem(r.id, it.id)?.condition : null;
          const flag = exit && worse(before, it.condition) ? ' neg' : '';
          return `<tr><td class="t" style="white-space:normal">${esc(it.label)}</td>${exit ? `<td class="t">${before ? conditionLabels[before] : '—'}</td>` : ''}<td class="t${flag}">${
            it.condition ? conditionLabels[it.condition] : '—'
          }</td><td class="t">${it.comment ? esc(it.comment) : ''}</td></tr>${
            it.photoIds.length ? `<tr><td colspan="${exit ? 4 : 3}" class="t">${photos(it.photoIds)}</td></tr>` : ''
          }`;
        })
        .join('')}</table></div>`,
    )
    .join('');
  const deductions = exit && inspection.deductions.length
    ? `<div class="avoid"><h2>Retenues sur la caution</h2><table>${inspection.deductions
        .map((d) => `<tr><td>${esc(d.label)}</td><td class="v">${esc(formatAmount(d.amount))}</td></tr>`)
        .join('')}<tr class="total"><td>Total</td><td class="v">${esc(formatAmount(inspection.deductions.reduce((s, d) => s + d.amount, 0)))}</td></tr></table>
       <p style="color:#475569">L’usure normale et la vétusté ne sont pas retenues. Montants justifiés par devis ou factures.</p></div>`
    : '';
  const k = inspection.keys;
  return page(
    title,
    `${header(title, `${esc(`${tenant.firstName} ${tenant.lastName}`)} · ${esc(unit.label)}`, brand)}
    <div class="parties">
      <div class="box"><div class="label">Logement</div><b>${esc(unit.label)}</b> · ${esc(property.name)}<br>${esc(property.district)}, ${esc(property.city)}</div>
      <div class="box"><div class="label">Date</div><b>${esc(formatDate(inspection.date))}</b><br>Établi contradictoirement, en présence des deux parties</div>
    </div>
    <div class="avoid"><h2>Compteurs</h2><table class="grid"><tr><th>Compteur</th><th>Numéro</th><th>Index</th></tr>
      ${meter('Électricité (CIE)', inspection.meters.electricity)}${meter('Eau (SODECI)', inspection.meters.water)}</table></div>
    <div class="avoid"><h2>Clés remises</h2><p>Logement : <b>${k.unit ?? '—'}</b> · Portail ou cour : <b>${k.gate ?? '—'}</b>${k.other ? ` · ${esc(k.other)}` : ''}</p></div>
    ${rooms}
    ${deductions}
    ${inspection.observations ? `<div class="avoid"><h2>Observations</h2><p>${esc(inspection.observations).replace(/\n/g, '<br>')}</p></div>` : ''}
    <div class="avoid"><p style="margin-top:20px">Les parties reconnaissent l’exactitude du présent état des lieux, annexé au bail.</p>
    <div class="sign"><div>${signatureSvg(inspection.landlordSignature)}<div class="line">Le bailleur</div></div><div>${signatureSvg(
      inspection.tenantSignature,
    )}<div class="line">Le locataire · ${esc(`${tenant.firstName} ${tenant.lastName}`)}</div></div></div></div>
    <div class="foot">État des lieux établi avec Kaza${inspection.signedAt ? `, signé le ${esc(formatDate(inspection.signedAt))}` : ''}. Un exemplaire pour chaque partie.</div>`,
    brand,
  );
}

export const inspectionFileName = (tenant: Tenant, kind: InspectionKind) =>
  slug(kind === 'entry' ? 'Etat-des-lieux-entree' : 'Etat-des-lieux-sortie', tenant.firstName, tenant.lastName);
