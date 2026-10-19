// Écrans bruts des stores, pris sur la démo web : npx expo export -p web, servie sur DEMO_URL (par défaut :8098).
// Usage : node store/scripts/captures-brutes.mjs puis node store/scripts/composer.mjs
import { fileURLToPath } from 'url';
const DEMO = process.env.DEMO_URL ?? 'http://127.0.0.1:8098';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
import { chromium } from 'playwright';
const O = ROOT + 'store/brut/'; import { mkdirSync } from 'fs'; mkdirSync(O, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'light' });
const p = await ctx.newPage();
const wait = (ms) => p.waitForTimeout(ms);
const vis = (t) => p.getByText(t).locator('visible=true').first();
const tab = (n) => p.getByRole('tab', { name: n }).or(p.getByRole('link', { name: n })).first().click();
const shot = (n) => p.screenshot({ path: O + n + '.png' });
await p.goto(DEMO + '/', { waitUntil: 'networkidle' }); await wait(800);
await p.getByRole('button', { name: 'Explorer la démo' }).click(); await wait(1500);
// Masque le bandeau « démo » (captures de la fiche du store)
const hideDemo = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => d.childElementCount > 0 && /^Vous explorez la démo/.test(d.textContent || '') && (d.textContent || '').length < 140);
  let n = el; while (n && n.parentElement && (n.parentElement.textContent || '').length < 140) n = n.parentElement;
  if (n) n.style.display = 'none';
});
await hideDemo(); await wait(300);
await shot('1-accueil');
await tab(/Locataires/); await wait(900); await shot('2-locataires');
await p.goto(DEMO + '/encaisser', { waitUntil: 'networkidle' }); await wait(1200);
await vis('Mariam Diallo').click(); await wait(400);
await p.getByText(/^Dû \+ 1 mois|^2 mois/).locator('visible=true').first().click(); await wait(500);
await p.mouse.wheel(0, 380); await wait(500); await shot('3-encaisser');
await p.goto(DEMO + '/', { waitUntil: 'networkidle' }); await wait(1500);
await p.getByRole('button').filter({ hasText: /Payé$/ }).locator('visible=true').first().click().catch(() => {}); await wait(1200);
await shot('4-quittance');
await p.goto(DEMO + '/locataires', { waitUntil: 'networkidle' }); await wait(1200);
await p.getByRole('button').filter({ hasText: 'Koffi Kouassi' }).locator('visible=true').first().click(); await wait(1200);
await shot('5-fiche');
await p.goto(DEMO + '/rapports', { waitUntil: 'networkidle' }); await wait(1500); await shot('6-rapports');
await p.goto(DEMO + '/notifications', { waitUntil: 'networkidle' }); await wait(1500); await shot('7-notifications');
await p.goto(DEMO + '/biens', { waitUntil: 'networkidle' }); await wait(1200); await shot('8-biens');
// Quittance d'un paiement de la démo
const id = await p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('kaza/state/v1') || '{}');
  return (st.payments || []).find((x) => x.tenantId === 't5' && x.id.includes('-0-'))?.id;
});
await p.goto(DEMO + '/quittance/' + id, { waitUntil: 'networkidle' }); await wait(1800);
await p.screenshot({ path: O + '4-quittance.png' });
await b.close(); console.log('ok');
