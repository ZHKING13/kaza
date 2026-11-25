import { methods } from '@/data/methods';
import { propertyTypes } from '@/data/propertyTypes';
import { defaultLeaseSettings, type LeaseSettings } from '@/data/rent';
import type { Identity, Profile } from '@/data/store';
import type { ChargeMode, IdType, LeaseContract, PayoutAccount, Property, Tenant, Unit } from '@/data/types';

import { amountWords, branding, type Branding, esc, header, page, slug } from './documents';
import { formatAmount, formatDateLong as formatDate, formatPhone } from './format';

/**
 * Contrat de bail (Côte d'Ivoire), rendu en HTML puis imprimé par expo-print, hors ligne.
 * Texte repris des brouillons de `kaza-api/docs/modeles-juridiques`, en attente de la relecture d'un juriste :
 * tant que `CONTRACT_TEMPLATE_REVIEWED` est faux, le document le dit en tête et en pied de page.
 */
export const CONTRACT_TEMPLATE_REVIEWED = false;

export const idTypeLabels: Record<IdType, string> = {
  cni: 'Carte nationale d’identité',
  passport: 'Passeport',
  consular_card: 'Carte consulaire',
  residence_permit: 'Carte de séjour',
  driving_licence: 'Permis de conduire',
  other: 'Autre pièce',
};

export const chargeModeLabels: Record<ChargeMode, string> = {
  tenant_meter: 'compteur individuel, abonnement au nom du locataire',
  shared: 'compteur partagé, réparti entre les occupants',
  included: 'compris dans le loyer',
};

type ContractArgs = {
  identity?: Identity;
  profile: Profile;
  tenant: Tenant;
  unit: Unit;
  property: Property;
  contract: LeaseContract;
  leaseSettings?: LeaseSettings;
  payoutAccounts?: PayoutAccount[];
};

const blank = '……………………………';
const value = (v: string | null | undefined) => (v && v.trim() ? esc(v.trim()) : blank);
const fullName = (p: { firstName: string; lastName: string }) => esc(`${p.firstName} ${p.lastName}`.trim());
const monthsBetween = (from: string, to: string) => {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(1, Math.round((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1)) + 1);
};

function article(n: number, title: string, body: string) {
  return `<div class="avoid"><h2>Article ${n} — ${esc(title)}</h2>${body}</div>`;
}

function party(label: string, lines: string[]) {
  return `<div class="box"><div class="label">${esc(label)}</div>${lines.join('<br>')}</div>`;
}

function landlordLines(profile: Profile, brand: Branding) {
  if (brand) return [`<b>${esc(brand.name)}</b>`, ...(brand.lines.length ? brand.lines : [formatPhone(profile.phone)]).map(esc)];
  return [`<b>${fullName(profile)}</b>`, esc(formatPhone(profile.phone))];
}

function tenantLines(tenant: Tenant, contract: LeaseContract) {
  const { idType, idNumber, profession } = contract.tenant;
  return [
    `<b>${fullName(tenant)}</b>`,
    `Profession : ${value(profession)}`,
    `${idType ? esc(idTypeLabels[idType]) : 'Pièce d’identité'} n° ${value(idNumber)}`,
    esc(formatPhone(tenant.phone)),
  ];
}

function paymentMeans(accounts: PayoutAccount[] | undefined) {
  const list = (accounts ?? []).map((a) => `${esc(methods[a.method].label)} au ${esc(formatPhone(a.number))}${a.name ? ` (${esc(a.name)})` : ''}`);
  return [...list, 'espèces, contre quittance'].join(' ; ');
}

function charges(contract: LeaseContract) {
  const t = contract.terms;
  return `<p>
    <b>Électricité (CIE)</b> : ${t.electricity ? esc(chargeModeLabels[t.electricity]) : blank}.<br>
    <b>Eau (SODECI)</b> : ${t.water ? esc(chargeModeLabels[t.water]) : blank}.<br>
    ${t.chargesFixed ? `<b>Forfait de charges</b> : ${esc(formatAmount(t.chargesFixed))} par mois, payable avec le loyer.<br>` : ''}
    <b>Autres charges</b> : ${t.otherCharges ? esc(t.otherCharges) : 'néant'}.
  </p><p>Les index des compteurs sont relevés dans l’état des lieux d’entrée et de sortie.</p>`;
}

function deposits(tenant: Tenant, rent: number, party: string) {
  const advance = tenant.advanceMonths ?? 0;
  const deposit = tenant.depositMonths ?? 0;
  return `<p>À la signature, ${party} verse :</p><ul>
    <li>une <b>avance</b> de ${advance} mois de loyer, soit <b>${esc(formatAmount(advance * rent))}</b>, imputée sur les premiers mois de location ;</li>
    <li>une <b>caution</b> (dépôt de garantie) de ${deposit} mois de loyer, soit <b>${esc(formatAmount(deposit * rent))}</b>.</li>
  </ul>`;
}

function guarantor(contract: LeaseContract, party: string) {
  const g = contract.terms.guarantor;
  if (!g) return '';
  return `<div class="box" style="margin-bottom:12px"><div class="label">Caution solidaire</div><b>${esc(g.name)}</b>${
    g.idType || g.idNumber ? `<br>${g.idType ? esc(idTypeLabels[g.idType]) : 'Pièce d’identité'} n° ${value(g.idNumber)}` : ''
  }${g.phone ? `<br>${esc(formatPhone(g.phone))}` : ''}<br><span style="color:#475569">S’engage à payer à la place ${party === 'le preneur' ? 'du preneur' : 'du locataire'} les sommes dues au titre du présent bail, si celui-ci ne les paie pas.</span></div>`;
}

function signatures(contract: LeaseContract, property: Property, brand: Branding) {
  const place = contract.terms.signaturePlace || property.city;
  const cols = ['Le bailleur', contract.usage === 'professional' ? 'Le preneur' : 'Le locataire', ...(contract.terms.guarantor ? ['La caution solidaire'] : [])];
  return `<div class="avoid"><p style="margin-top:22px">Fait à ${esc(place)}, le ${blank}, en ${cols.length} exemplaires originaux.</p>
  <div class="sign">${cols
    .map(
      (c, i) =>
        `<div>${i === 0 && brand?.stamp ? `<img class="stamp" src="${brand.stamp}" alt="Cachet">` : ''}<div class="line">${esc(c)}<br>« ${
          c === 'La caution solidaire' ? 'Bon pour caution solidaire' : 'Lu et approuvé'
        } »</div></div>`,
    )
    .join('')}</div></div>`;
}

const draftNote = () =>
  CONTRACT_TEMPLATE_REVIEWED
    ? ''
    : '<p class="note" style="margin-top:10px">Projet établi avec Kaza. Modèle en cours de relecture juridique : relisez-le, et faites-le vérifier si besoin, avant de le signer.</p>';

/** Contrat de bail à usage d'habitation ou professionnel, selon `contract.usage`. */
export function contractHtml({ identity, profile, tenant, unit, property, contract, leaseSettings, payoutAccounts }: ContractArgs) {
  const brand = branding(identity, profile);
  const professional = contract.usage === 'professional';
  const title = professional ? 'Bail à usage professionnel' : 'Bail à usage d’habitation';
  const rent = tenant.rent ?? unit.rent;
  const entry = tenant.entryDate ?? new Date().toISOString();
  const rules = leaseSettings ?? defaultLeaseSettings;
  const Who = professional ? 'Le preneur' : 'Le locataire';
  const duration = tenant.endDate
    ? `<p>Le bail est conclu pour une durée de <b>${monthsBetween(entry, tenant.endDate)} mois</b>, du ${esc(formatDate(entry))} au ${esc(formatDate(tenant.endDate))}. À son terme, il se poursuit aux mêmes conditions, sauf congé donné dans les formes et délais prévus ci-après.</p>`
    : `<p>Le bail est conclu pour une <b>durée indéterminée</b> à compter du ${esc(formatDate(entry))}.</p>`;
  const special = contract.terms.specialClauses?.trim();

  let n = 0;
  const articles = professional
    ? [
        article(++n, 'Objet et désignation', `<p>Le bailleur donne à bail au preneur le local suivant : <b>${esc(unit.label)}</b> (${esc(propertyTypes[property.type].label.toLowerCase())}), situé ${esc(property.name)}, ${esc(property.district)}, ${esc(property.city)}.</p>`),
        article(++n, 'Destination', `<p>Le local est destiné exclusivement à l’activité suivante : <b>${value(contract.terms.activity)}</b>. Tout changement d’activité requiert l’accord écrit du bailleur.</p>`),
        article(
          ++n,
          'Durée et renouvellement',
          `${duration}<p>Le preneur qui a exploité son activité dans les lieux pendant au moins deux ans a droit au renouvellement du bail à durée déterminée, s’il en fait la demande au plus tard trois mois avant son terme, conformément à l’Acte uniforme OHADA portant sur le droit commercial général.</p>`,
        ),
        article(++n, 'Loyer', `<p>Le loyer mensuel est fixé à <b>${esc(formatAmount(rent))}</b> (${esc(amountWords(rent))}), payable d’avance au plus tard le <b>${tenant.dueDay} de chaque mois</b>, par : ${paymentMeans(payoutAccounts)}. Chaque paiement donne lieu à une quittance.</p>`),
        article(++n, 'Révision du loyer', '<p>À défaut d’accord entre les parties, le loyer peut être révisé dans les conditions prévues par l’Acte uniforme OHADA portant sur le droit commercial général.</p>'),
        article(++n, 'Avance et dépôt de garantie', `${deposits(tenant, rent, 'le preneur')}<p>Le dépôt de garantie est restitué en fin de bail, déduction faite des sommes restant dues, sur justificatifs.</p>`),
        article(++n, 'Charges', `${charges(contract)}<p>Les impôts et taxes liés à l’activité du preneur sont à sa charge.</p>`),
        article(++n, 'Obligations du bailleur', '<p>Délivrer le local en bon état ; faire les grosses réparations ; assurer au preneur la jouissance paisible des lieux ; ne pas modifier unilatéralement l’état des lieux.</p>'),
        article(++n, 'Obligations du preneur', '<p>Payer le loyer aux échéances ; exploiter le local conformément à sa destination et en bon père de famille ; faire l’entretien courant et les réparations locatives ; respecter les règles d’hygiène et de sécurité liées à son activité ; ne pas transformer le local sans accord écrit ; le restituer en fin de bail dans l’état constaté à l’entrée, sauf usure normale.</p>'),
        article(++n, 'Cession et sous-location', '<p>La cession du bail et la sous-location sont soumises aux conditions de l’Acte uniforme OHADA ; la sous-location requiert l’accord écrit du bailleur.</p>'),
        article(++n, 'Résiliation', '<p>À défaut de paiement du loyer ou de respect d’une clause du bail, le bailleur peut demander en justice la résiliation du bail et l’expulsion du preneur, après une mise en demeure par acte d’huissier restée sans effet pendant un mois.</p>'),
        article(++n, 'Litiges', '<p>Les parties s’efforcent de régler à l’amiable tout différend. À défaut, le tribunal compétent est celui du lieu de situation du local.</p>'),
      ]
    : [
        article(
          ++n,
          'Objet et désignation des lieux',
          `<p>Le bailleur donne en location au locataire, qui accepte, le logement <b>${esc(unit.label)}</b> (${esc(propertyTypes[property.type].label.toLowerCase())}), situé ${esc(property.name)}, ${esc(property.district)}, ${esc(property.city)}.</p><p>Le logement est loué à <b>usage exclusif d’habitation</b> du locataire et des personnes vivant habituellement avec lui. Toute activité commerciale ou professionnelle y est interdite sans accord écrit du bailleur.</p>`,
        ),
        article(++n, 'Durée', duration),
        article(++n, 'Loyer', `<p>Le loyer mensuel est fixé à <b>${esc(formatAmount(rent))}</b> (${esc(amountWords(rent))}), charges non comprises. Il est payable d’avance, au plus tard le <b>${tenant.dueDay} de chaque mois</b>, par : ${paymentMeans(payoutAccounts)}. Chaque paiement donne lieu à la remise <b>gratuite</b> d’une quittance.</p>`),
        article(
          ++n,
          'Avance et caution',
          `${deposits(tenant, rent, 'le locataire')}<p>Conformément à la loi n° 2019-576 du 26 juin 2019 instituant le Code de la construction et de l’habitat, l’avance et la caution ne peuvent chacune dépasser deux mois de loyer. La caution ne produit pas d’intérêts ; elle est restituée après la remise des clés, déduction faite des sommes restant dues (loyers, charges, réparations locatives constatées par l’état des lieux de sortie), sur justificatifs.</p>`,
        ),
        article(++n, 'Charges', charges(contract)),
        article(++n, 'État des lieux', '<p>Un état des lieux contradictoire est établi à l’entrée et à la sortie du locataire, signé des deux parties et annexé au présent bail.</p>'),
        article(
          ++n,
          'Obligations du bailleur',
          '<p>Le bailleur s’oblige à délivrer un logement décent, en bon état d’usage et de réparation ; à assurer au locataire la jouissance paisible du logement ; à effectuer les grosses réparations ; à remettre gratuitement une quittance pour chaque paiement ; à ne pas modifier la forme ou la destination du logement en cours de bail.</p>',
        ),
        article(
          ++n,
          'Obligations du locataire',
          '<p>Le locataire s’oblige à payer le loyer et les charges aux dates convenues ; à user paisiblement du logement suivant sa destination d’habitation ; à assurer l’entretien courant et les menues réparations, sauf usure normale ou vétusté ; à répondre des dégradations survenues pendant la location ; à ne pas transformer le logement, ni le sous-louer ou céder le bail, sans accord écrit du bailleur ; à rendre le logement en fin de bail dans l’état constaté à l’entrée, sauf usure normale.</p>',
        ),
        article(
          ++n,
          'Congé et préavis',
          `<p><b>Par le locataire</b> : à tout moment, avec un préavis de <b>${rules.noticeTenantMonths} mois</b>, notifié par écrit.<br><b>Par le bailleur</b> : avec un préavis de <b>${rules.noticeLandlordMonths} mois</b>, pour un motif admis par la loi (reprise pour habiter, vente, motif légitime et sérieux, notamment un manquement du locataire).</p>`,
        ),
        article(++n, 'Révision du loyer', '<p>Le loyer peut être révisé dans les conditions prévues par la loi.</p>'),
        article(
          ++n,
          'Clause résolutoire',
          '<p>À défaut de paiement d’un terme de loyer à son échéance, ou d’inexécution de l’une des obligations du présent bail, et un mois après une mise en demeure restée sans effet, le bail pourra être résilié dans les conditions prévues par la loi.</p>',
        ),
        article(++n, 'Enregistrement', '<p>Le présent bail est enregistré conformément à la loi.</p>'),
        article(++n, 'Litiges', '<p>Les parties s’efforcent de régler à l’amiable tout différend né du présent bail. À défaut, le tribunal compétent est celui du lieu de situation du logement.</p>'),
      ];
  if (special) articles.push(article(++n, 'Clauses particulières', `<p>${esc(special).replace(/\n/g, '<br>')}</p>`));

  return page(
    title,
    `${header(title, `${fullName(tenant)} · ${esc(unit.label)}`, brand)}
    ${draftNote()}
    <p style="margin-top:14px"><b>Entre les soussignés :</b></p>
    <div class="parties">${party('Le bailleur', landlordLines(profile, brand))}${party(Who, tenantLines(tenant, contract))}</div>
    ${guarantor(contract, professional ? 'le preneur' : 'le locataire')}
    <p>Il a été convenu ce qui suit.</p>
    ${articles.join('')}
    ${signatures(contract, property, brand)}
    <p style="margin-top:16px;color:#475569">Annexes : état des lieux d’entrée ; copie des pièces d’identité.</p>
    <div class="foot">Contrat établi avec Kaza${CONTRACT_TEMPLATE_REVIEWED ? '' : ' (modèle en cours de relecture juridique)'}. Un exemplaire pour chaque partie.</div>`,
    brand,
  ).replace('</style>', 'ul{margin:4px 0 8px 18px;padding:0} p{margin:4px 0}</style>');
}

/** Nom du fichier partagé : « Bail-Awa-Kone-Chambre-3 » */
export const contractFileName = (tenant: Tenant, unit: Unit) => slug('Bail', tenant.firstName, tenant.lastName, unit.label);
