// Visuels des stores : titre + phrase d'appui + capture dans un cadre de téléphone
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const F = ROOT + 'node_modules/@expo-google-fonts/ibm-plex-sans/';
const font = (w, f) => `@font-face{font-family:Plex;font-weight:${w};src:url(data:font/ttf;base64,${readFileSync(F + f).toString('base64')})}`;
const css = font(400, '400Regular/IBMPlexSans_400Regular.ttf') + font(600, '600SemiBold/IBMPlexSans_600SemiBold.ttf') + font(700, '700Bold/IBMPlexSans_700Bold.ttf');
const R = ROOT + 'store/brut/';
const OUT = ROOT + 'store/';
const slides = [
  ['1-accueil', 'Vos loyers du mois, d’un coup d’œil', 'Encaissé, impayés, logements vacants et dépenses : tout est là.'],
  ['3-encaisser', 'Encaissez en espèces ou mobile money', 'Un montant sur plusieurs mois ? Kaza le répartit tout seul.'],
  ['4-quittance', 'La quittance part toute seule', 'PDF à vos couleurs, envoyé au locataire sur WhatsApp.'],
  ['2-locataires', 'Qui a payé, qui est en retard', 'Statut de chaque locataire, mois par mois.'],
  ['5-fiche', 'Relancez en un geste', 'Relance WhatsApp, lien de paiement Wave, Orange, MTN, Moov.'],
  ['8-biens', 'Tous vos biens au même endroit', 'Cours communes, immeubles, villas, magasins.'],
  ['6-rapports', 'Relevés PDF et Excel', 'Compte rendu de gestion pour chaque propriétaire.'],
  ['7-notifications', 'Fonctionne même sans connexion', 'Tout est gardé sur le téléphone et se synchronise au retour du réseau.'],
];
const sizes = { android: [1080, 1920], ios: [1320, 2868] };
const page = (w, h, img, title, sub) => `<!doctype html><html><head><style>${css}
*{margin:0;box-sizing:border-box}body{width:${w}px;height:${h}px;font-family:Plex;background:linear-gradient(170deg,#0F766E 0%,#115E59 60%,#0B4F4A 100%);overflow:hidden;position:relative}
.t{position:absolute;left:${w*0.08}px;right:${w*0.08}px;top:${h*0.055}px;color:#fff;font-weight:700;font-size:${w*0.072}px;line-height:1.15;letter-spacing:-0.5px}
.s{position:absolute;left:${w*0.08}px;right:${w*0.08}px;top:${h*0.055 + w*0.072*2.5}px;color:#CCFBF1;font-weight:400;font-size:${w*0.038}px;line-height:1.35}
.dot{display:inline-block;width:${w*0.03}px;height:${w*0.03}px;border-radius:50%;background:#FB923C;margin-left:6px;vertical-align:middle}
.phone{position:absolute;left:50%;transform:translateX(-50%);top:${h*0.27}px;width:${w*0.74}px;height:${w*0.74*2.164}px;background:#0F172A;border-radius:${w*0.075}px;padding:${w*0.018}px;box-shadow:0 ${w*0.03}px ${w*0.08}px rgba(0,0,0,.35)}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:${w*0.06}px;display:block}
</style></head><body><div class="t">${title}</div><div class="s">${sub}</div>
<div class="phone"><img src="data:image/png;base64,${readFileSync(R + img + '.png').toString('base64')}"></div></body></html>`;
const b = await chromium.launch();
for (const [os, [w, h]] of Object.entries(sizes)) {
  mkdirSync(OUT + 'captures/' + os, { recursive: true });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const [i, [img, title, sub]] of slides.entries()) {
    await p.setContent(page(w, h, img, title, sub)); await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}captures/${os}/${String(i + 1).padStart(2, '0')}-${img.slice(2)}.png` });
  }
  await p.close();
}
// Bannière Play Store 1024x500
const icon = readFileSync(ROOT + 'assets/brand/kaza-icon.svg', 'utf8');
const fg = await b.newPage({ viewport: { width: 1024, height: 500 } });
await fg.setContent(`<!doctype html><html><head><style>${css}*{margin:0}body{width:1024px;height:500px;font-family:Plex;background:linear-gradient(160deg,#0F766E,#0B4F4A);display:flex;align-items:center;gap:48px;padding:0 72px;box-sizing:border-box;overflow:hidden}
.i svg{width:180px;height:180px;filter:drop-shadow(0 12px 30px rgba(0,0,0,.3))}h1{color:#fff;font-weight:700;font-size:64px;letter-spacing:-1px}p{color:#CCFBF1;font-size:30px;line-height:1.3;margin-top:10px;max-width:620px}</style></head>
<body><div class="i">${icon}</div><div><h1>Kaza</h1><p>Loyers, quittances et relances WhatsApp. Même sans connexion.</p></div></body></html>`);
await fg.waitForTimeout(150);
await fg.screenshot({ path: OUT + 'play-feature-graphic-1024x500.png' });
// Icône Play Store 512x512 (carrée, Google arrondit lui-même)
const full = readFileSync(ROOT + 'assets/brand/kaza-icon-fullbleed.svg', 'utf8');
const ic = await b.newPage({ viewport: { width: 512, height: 512 } });
await ic.setContent(`<!doctype html><html><body style="margin:0">${full.replace('<svg ', '<svg style="display:block;width:512px;height:512px" ')}</body></html>`);
await ic.screenshot({ path: OUT + 'play-icon-512.png' });
await b.close(); console.log('ok');
