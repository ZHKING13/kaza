import { useLocalSearchParams } from 'expo-router';
import { Camera, Check, FileSignature, FileText, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { PdfButton } from '@/components/PdfButton';
import { PhoneField } from '@/components/PhoneField';
import { RemoteSignature } from '@/components/RemoteSignature';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { type Country, countries, splitPhone } from '@/data/countries';
import { emptyContract, usePermissions, useStore } from '@/data/store';
import type { ChargeMode, ContractPage, IdType, LeaseContract, LeaseUsage } from '@/data/types';
import { errorMessage } from '@/lib/api';
import { CONTRACT_TEMPLATE_REVIEWED, contractFileName, contractHtml, idTypeLabels } from '@/lib/contract';
import { pickImage, takePhoto } from '@/lib/images';
import { radius, space, useTheme } from '@/theme';

const ID_TYPES: IdType[] = ['cni', 'passport', 'consular_card', 'residence_permit', 'driving_licence', 'other'];
const CHARGE_MODES: ChargeMode[] = ['tenant_meter', 'shared', 'included'];
const shortCharge: Record<ChargeMode, string> = { tenant_meter: 'Compteur du locataire', shared: 'Compteur partagé', included: 'Compris dans le loyer' };
/** Photo d'une page : assez nette pour être lue, assez légère pour partir en 3G */
const PAGE_PHOTO = { maxSide: 1800, format: 'jpeg' as const };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      {hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
      {children}
    </Card>
  );
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

/**
 * Contrat de bail : les informations qui manquent au bail (usage, pièce d'identité, charges, garant, clauses), le PDF
 * prêt à imprimer ou à partager, généré sur le téléphone même sans réseau, et les pages du contrat papier une fois signé.
 */
export default function BailLocataire() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenants, units, properties, profile, identity, settings, updateContract, addContractPage, removeContractPage } = useStore();
  const { can } = usePermissions();
  const tenant = tenants.find((t) => t.id === id);
  const saved = tenant?.contract ?? emptyContract();

  const [usage, setUsage] = useState<LeaseUsage>(saved.usage);
  const [idType, setIdType] = useState<IdType | null>(saved.tenant.idType);
  const [idNumber, setIdNumber] = useState(saved.tenant.idNumber ?? '');
  const [profession, setProfession] = useState(saved.tenant.profession ?? '');
  const [activity, setActivity] = useState(saved.terms.activity ?? '');
  const [electricity, setElectricity] = useState<ChargeMode | null>(saved.terms.electricity);
  const [water, setWater] = useState<ChargeMode | null>(saved.terms.water);
  const [chargesFixed, setChargesFixed] = useState(saved.terms.chargesFixed ? String(saved.terms.chargesFixed) : '');
  const [otherCharges, setOtherCharges] = useState(saved.terms.otherCharges ?? '');
  const [hasGuarantor, setHasGuarantor] = useState(!!saved.terms.guarantor);
  const [guarantorName, setGuarantorName] = useState(saved.terms.guarantor?.name ?? '');
  const initialPhone = splitPhone(saved.terms.guarantor?.phone ?? '', countries[0]);
  const [guarantorCountry, setGuarantorCountry] = useState<Country>(initialPhone.country);
  const [guarantorPhone, setGuarantorPhone] = useState(initialPhone.national);
  const [guarantorIdType, setGuarantorIdType] = useState<IdType | null>(saved.terms.guarantor?.idType ?? null);
  const [guarantorIdNumber, setGuarantorIdNumber] = useState(saved.terms.guarantor?.idNumber ?? '');
  const [specialClauses, setSpecialClauses] = useState(saved.terms.specialClauses ?? '');
  const [signaturePlace, setSignaturePlace] = useState(saved.terms.signaturePlace ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [savedNote, setSavedNote] = useState<string>();
  const [pageBusy, setPageBusy] = useState(false);
  const [pageError, setPageError] = useState<string>();
  const [removing, setRemoving] = useState<ContractPage | null>(null);

  if (!tenant || tenant.exitDate || !can('leases.manage')) {
    return <EmptyState icon={FileSignature} title="Contrat indisponible" body="Ce locataire est parti, ou votre rôle ne permet pas de gérer les baux." />;
  }
  const unit = units.find((u) => u.id === tenant.unitId)!;
  const property = properties.find((p) => p.id === unit.propertyId)!;

  const digits = guarantorPhone.replace(/\D/g, '');
  const draft = (): Omit<LeaseContract, 'pages'> => ({
    usage,
    tenant: { idType, idNumber: orNull(idNumber), profession: orNull(profession) },
    terms: {
      activity: usage === 'professional' ? orNull(activity) : null,
      electricity,
      water,
      chargesFixed: chargesFixed.replace(/\D/g, '') ? Number(chargesFixed.replace(/\D/g, '')) : null,
      otherCharges: orNull(otherCharges),
      guarantor:
        hasGuarantor && guarantorName.trim()
          ? {
              name: guarantorName.trim(),
              phone: digits ? `+${guarantorCountry.dial}${digits}` : null,
              idType: guarantorIdType,
              idNumber: orNull(guarantorIdNumber),
            }
          : null,
      specialClauses: orNull(specialClauses),
      signaturePlace: orNull(signaturePlace),
    },
  });

  const save = async () => {
    if (hasGuarantor && digits && digits.length !== guarantorCountry.length) {
      setError(`Le numéro du garant doit compter ${guarantorCountry.length} chiffres (${guarantorCountry.name}).`);
      return;
    }
    setBusy(true);
    setError(undefined);
    setSavedNote(undefined);
    try {
      await updateContract(tenant.id, draft());
      setSavedNote('Enregistré. Le contrat reprend ces informations.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addPage = async (source: 'camera' | 'library') => {
    setPageBusy(true);
    setPageError(undefined);
    try {
      const uri = source === 'camera' ? await takePhoto(PAGE_PHOTO) : await pickImage(PAGE_PHOTO);
      if (uri) await addContractPage(tenant.id, uri);
    } catch (e) {
      setPageError(
        e instanceof Error && e.message === 'camera'
          ? 'Autorisez l’appareil photo dans les réglages du téléphone pour photographier le contrat.'
          : errorMessage(e),
      );
    } finally {
      setPageBusy(false);
    }
  };

  const pages = saved.pages;
  const html = (landlordSignature?: string) =>
    contractHtml({
      identity,
      profile,
      tenant,
      unit,
      property,
      contract: { ...draft(), pages },
      leaseSettings: settings.leases,
      payoutAccounts: settings.payoutAccounts,
      electronic: landlordSignature ? { landlordSignature } : undefined,
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">
          Le loyer, l’échéance, les dates, l’avance et la caution viennent du bail. Complétez le reste, puis partagez le contrat ou
          imprimez-le pour le faire signer.
        </Text>
        {!CONTRACT_TEMPLATE_REVIEWED ? (
          <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.sm }}>
            <Text variant="small">
              Modèle pour la Côte d’Ivoire, en cours de relecture par un juriste. Relisez le contrat avant de le faire signer.
            </Text>
          </View>
        ) : null}

        <Section title="Type de bail">
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <Chip label="Habitation" selected={usage === 'habitation'} onPress={() => setUsage('habitation')} />
            <Chip label="Usage professionnel (magasin, bureau)" selected={usage === 'professional'} onPress={() => setUsage('professional')} />
          </View>
          {usage === 'professional' ? (
            <TextField label="Activité exercée dans le local" value={activity} onChangeText={setActivity} placeholder="Ex. vente de pagnes" maxLength={120} />
          ) : null}
        </Section>

        <Section title={`${tenant.firstName} ${tenant.lastName}`} hint="Pièce d’identité et profession, imprimées dans le contrat.">
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {ID_TYPES.map((t) => (
              <Chip key={t} label={idTypeLabels[t]} selected={idType === t} onPress={() => setIdType(idType === t ? null : t)} />
            ))}
          </View>
          <TextField label="Numéro de la pièce" value={idNumber} onChangeText={setIdNumber} autoCapitalize="characters" maxLength={40} />
          <TextField label="Profession" value={profession} onChangeText={setProfession} maxLength={80} />
        </Section>

        <Section title="Charges">
          <Text variant="bodyStrong">Électricité (CIE)</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {CHARGE_MODES.map((m) => (
              <Chip key={m} label={shortCharge[m]} selected={electricity === m} onPress={() => setElectricity(electricity === m ? null : m)} />
            ))}
          </View>
          <Text variant="bodyStrong">Eau (SODECI)</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {CHARGE_MODES.map((m) => (
              <Chip key={m} label={shortCharge[m]} selected={water === m} onPress={() => setWater(water === m ? null : m)} />
            ))}
          </View>
          <TextField
            label="Forfait de charges par mois (facultatif)"
            value={chargesFixed}
            onChangeText={(v) => setChargesFixed(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            suffix="FCFA"
          />
          <TextField label="Autres charges (facultatif)" value={otherCharges} onChangeText={setOtherCharges} placeholder="Ex. ordures : 2 000 FCFA par mois" maxLength={300} />
        </Section>

        <Section title="Garant" hint="Une personne qui paie à la place du locataire s’il ne paie pas (facultatif).">
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <Chip label="Sans garant" selected={!hasGuarantor} onPress={() => setHasGuarantor(false)} />
            <Chip label="Avec un garant" selected={hasGuarantor} onPress={() => setHasGuarantor(true)} />
          </View>
          {hasGuarantor ? (
            <>
              <TextField label="Nom et prénom du garant" value={guarantorName} onChangeText={setGuarantorName} maxLength={120} />
              <PhoneField
                label="Téléphone du garant (facultatif)"
                country={guarantorCountry}
                national={guarantorPhone}
                onChange={(country, national) => {
                  setGuarantorCountry(country);
                  setGuarantorPhone(national);
                }}
              />
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {ID_TYPES.map((t) => (
                  <Chip key={t} label={idTypeLabels[t]} selected={guarantorIdType === t} onPress={() => setGuarantorIdType(guarantorIdType === t ? null : t)} />
                ))}
              </View>
              <TextField label="Numéro de sa pièce" value={guarantorIdNumber} onChangeText={setGuarantorIdNumber} autoCapitalize="characters" maxLength={40} />
            </>
          ) : null}
        </Section>

        <Section title="Clauses particulières" hint="Ce que vous avez convenu en plus (travaux, animaux, enseigne…). Facultatif.">
          <TextField label="Clauses" value={specialClauses} onChangeText={setSpecialClauses} multiline maxLength={4000} />
          <TextField label="Lieu de signature" value={signaturePlace} onChangeText={setSignaturePlace} placeholder={property.city} maxLength={80} />
        </Section>

        <FormError message={error} />
        {savedNote ? (
          <Text variant="small" tone="primary">
            {savedNote}
          </Text>
        ) : null}
        <Button label={busy ? 'Enregistrement…' : 'Enregistrer'} icon={Check} variant="secondary" disabled={busy} onPress={save} />
        <PdfButton label="Partager le contrat (PDF)" html={() => html()} fileName={contractFileName(tenant, unit)} variant="primary" />
        <Text variant="small" tone="muted">
          Le PDF reprend ce qui est à l’écran, même sans réseau.
        </Text>

        <RemoteSignature
          tenant={tenant}
          html={(signature) => html(signature)}
          fileName={contractFileName(tenant, unit)}
          beforeSend={() => updateContract(tenant.id, draft())}
        />

        <Section
          title="Contrat signé"
          hint="Une fois le contrat signé, photographiez chaque page : elles sont gardées avec le bail, et le locataire les retrouve dans son espace.">
          {pages.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {pages.map((p, i) => (
                <View key={p.id} style={{ width: 96, gap: 4 }}>
                  <Pressable
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`Ouvrir la page ${i + 1}`}
                    onPress={() => p.url && /^https?:/.test(p.url) && Linking.openURL(p.url)}>
                    {p.contentType.startsWith('image/') && p.url ? (
                      <Image source={{ uri: p.url }} style={{ width: 96, height: 128, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }} />
                    ) : (
                      <View style={{ width: 96, height: 128, borderRadius: radius.sm, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={28} color={c.textMuted} />
                      </View>
                    )}
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text variant="caption" tone="muted">
                      {p.pending ? 'En attente' : `Page ${i + 1}`}
                    </Text>
                    {!p.pending ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Retirer la page ${i + 1}`} hitSlop={10} onPress={() => setRemoving(p)}>
                        <Trash2 size={16} color={c.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          <FormError message={pageError} />
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            {Platform.OS !== 'web' ? (
              <Button label="Photographier" icon={Camera} variant="secondary" style={{ flex: 1 }} disabled={pageBusy} onPress={() => addPage('camera')} />
            ) : null}
            <Button label="Galerie" icon={ImagePlus} variant="secondary" style={{ flex: 1 }} disabled={pageBusy} onPress={() => addPage('library')} />
          </View>
        </Section>
      </ScrollView>

      <ConfirmSheet
        visible={!!removing}
        title="Retirer cette page ?"
        message="Elle disparaît du bail et de l’espace du locataire."
        confirmLabel="Retirer la page"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await removeContractPage(tenant.id, removing.id);
          } catch (e) {
            setPageError(errorMessage(e));
          }
          setRemoving(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}
