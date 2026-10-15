import { Stack } from 'expo-router';
import { Check, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/FormError';
import { PdfButton } from '@/components/PdfButton';
import { ReceiptHeader, useReceiptBrand } from '@/components/ReceiptHeader';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { type BrandColor, brandColors } from '@/data/brand';
import type { IdentityFields } from '@/data/remote';
import { type Identity, usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { receiptHtml } from '@/lib/documents';
import { formatAmount, formatPhone } from '@/lib/format';
import { pickImage } from '@/lib/images';
import { radius, space, useTheme } from '@/theme';

const FIELDS = ['legalName', 'address', 'phone', 'email', 'registrationNumber', 'taxId', 'receiptFooter'] as const;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ gap: 2 }}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        {hint ? (
          <Text variant="small" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Aperçu de la quittance avec l'identité en cours de saisie. */
function Preview({ identity }: { identity: Identity }) {
  const { profile } = useStore();
  const { brand, color } = useReceiptBrand(identity);
  const name = brand?.name ?? `${profile.firstName} ${profile.lastName}`.trim();
  const lines = brand?.lines.length ? brand.lines : profile.phone ? [formatPhone(profile.phone)] : [];
  return (
    <Card style={{ gap: space.sm, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }} accessibilityLabel="Aperçu de la quittance">
      <ReceiptHeader title="Quittance de loyer" number="N° Q-202610-7F3A" identity={identity} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color="#475569">
            BAILLEUR
          </Text>
          <Text variant="bodyStrong" color="#0F172A">
            {name}
          </Text>
          {lines.map((l) => (
            <Text key={l} variant="caption" color="#475569">
              {l}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color="#475569">
            LOCATAIRE
          </Text>
          <Text variant="bodyStrong" color="#0F172A">
            Awa Koné
          </Text>
          <Text variant="caption" color="#475569">
            Chambre 1
          </Text>
        </View>
      </View>
      <View style={{ backgroundColor: color.soft, borderColor: color.line, borderWidth: 1, borderRadius: radius.md, padding: space.sm }}>
        <Text variant="h2" color="#0F172A">
          {formatAmount(85000)}
        </Text>
        <Text variant="caption" color="#475569">
          Quatre-vingt-cinq mille francs CFA
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {brand?.stamp ? (
          <Image source={{ uri: brand.stamp }} style={{ width: 120, height: 60 }} resizeMode="contain" accessibilityLabel="Cachet" />
        ) : null}
        <Text variant="caption" color="#475569">
          Le bailleur · {name}
        </Text>
      </View>
      {brand?.footer ? (
        <Text variant="small" color="#0F172A" style={{ fontStyle: 'italic' }}>
          {brand.footer}
        </Text>
      ) : null}
    </Card>
  );
}

function ImageField({
  label,
  uri,
  readOnly,
  onPick,
  onRemove,
}: {
  label: string;
  uri?: string;
  readOnly: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View
        style={{
          width: 96,
          height: 56,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: 88, height: 48 }} resizeMode="contain" accessibilityLabel={label} />
        ) : (
          <ImagePlus size={20} color={c.textMuted} />
        )}
      </View>
      {readOnly ? (
        <Text variant="small" tone="muted" style={{ flex: 1 }}>
          {uri ? label : 'Aucune image'}
        </Text>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          <Button label={uri ? 'Changer' : `Choisir`} icon={ImagePlus} variant="secondary" compact onPress={onPick} />
          {uri ? <Button label="Retirer" icon={Trash2} variant="ghost" compact onPress={onRemove} /> : null}
        </View>
      )}
    </View>
  );
}

/** Identité de l'espace imprimée sur les quittances et le solde de départ (propriétaire). */
export default function IdentiteScreen() {
  const { c } = useTheme();
  const { identity, setIdentity, setIdentityImage, profile } = useStore();
  const { isOwner } = usePermissions();
  const readOnly = !isOwner;
  const [draft, setDraft] = useState<IdentityFields>(() => ({ ...identity }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  const preview: Identity = { ...identity, ...draft };
  const changed = FIELDS.filter((k) => (draft[k]?.trim() || null) !== (identity[k] || null));
  const colorChanged = draft.brandColor !== identity.brandColor;
  const emailInvalid = !!draft.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());

  const set = (k: keyof IdentityFields, v: string) => {
    setSaved(false);
    setDraft({ ...draft, [k]: v });
  };

  const save = async () => {
    if (emailInvalid) return;
    setSaving(true);
    setError(undefined);
    try {
      const body: Partial<IdentityFields> = {};
      for (const k of changed) body[k] = draft[k]?.trim() || null;
      if (colorChanged) body.brandColor = draft.brandColor;
      await setIdentity(body);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const image = (target: 'logo' | 'stamp') => async () => {
    setError(undefined);
    try {
      const uri = await pickImage({ maxSide: target === 'logo' ? 600 : 500, format: 'png' });
      if (uri) await setIdentityImage(target, uri);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const remove = (target: 'logo' | 'stamp') => () => setIdentityImage(target, null).catch((e) => setError(errorMessage(e)));

  const field = (k: (typeof FIELDS)[number], label: string, placeholder: string, extra?: object) => (
    <TextField
      label={label}
      value={draft[k] ?? ''}
      onChangeText={(v) => set(k, v)}
      placeholder={placeholder}
      editable={!readOnly}
      {...extra}
    />
  );

  const sample = () =>
    receiptHtml({
      identity: preview,
      payment: { id: 'exemple', tenantId: 'exemple', amount: 85000, method: 'wave', date: new Date().toISOString(), period: '2026-10' },
      paidForPeriod: 85000,
      dueForPeriod: 85000,
      tenant: { id: 'exemple', firstName: 'Awa', lastName: 'Koné', phone: '+2250712345678', unitId: 'u', dueDay: 5, advanceMonthsLeft: 0, depositMonths: 2 },
      unit: { id: 'u', propertyId: 'p', label: 'Chambre 1', rent: 85000 },
      property: { id: 'p', name: 'Cour Konan', type: 'cour', district: 'Abobo', city: 'Abidjan' },
      profile,
    });

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: 'Identité et quittances' }} />
      <Text tone="muted">
        {readOnly
          ? 'Ce que l’espace imprime sur ses quittances. Seul le propriétaire peut le modifier.'
          : 'Ce que vos locataires voient sur leurs quittances et leur solde de départ, dans l’application comme sur WhatsApp.'}
      </Text>

      <Section title="Aperçu">
        <Preview identity={preview} />
        <PdfButton label="Voir une quittance d’exemple (PDF)" html={sample} fileName="Quittance-exemple" />
      </Section>

      <Section title="Société" hint="Laissez vide ce qui ne vous concerne pas : la quittance affiche alors votre nom.">
        {field('legalName', 'Raison sociale', 'Agence Immobilière Koné SARL')}
        {field('address', 'Adresse', 'Cocody Angré, 7e tranche, Abidjan')}
        {field('phone', 'Téléphone affiché', '+225 07 12 34 56 78', { keyboardType: 'phone-pad' })}
        {field('email', 'E-mail', 'contact@agence.ci', {
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          error: emailInvalid ? 'Cette adresse e-mail n’est pas valide.' : undefined,
        })}
        {field('registrationNumber', 'RCCM', 'CI-ABJ-2021-B-12345', { autoCapitalize: 'characters' })}
        {field('taxId', 'Numéro fiscal (NCC, NINEA…)', '2101234A', { autoCapitalize: 'characters' })}
      </Section>

      <Section title="Couleur des quittances">
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {(Object.keys(brandColors) as BrandColor[]).map((k) => {
            const on = draft.brandColor === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: readOnly }}
                accessibilityLabel={brandColors[k].label}
                disabled={readOnly}
                onPress={() => {
                  setSaved(false);
                  setDraft({ ...draft, brandColor: k });
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.full,
                  backgroundColor: brandColors[k].main,
                  borderWidth: on ? 3 : 0,
                  borderColor: c.text,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {on ? <Check size={20} color="#FFFFFF" /> : null}
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Logo" hint="PNG ou JPEG. Il remplace « Kaza » en haut des quittances.">
        <ImageField label="Logo" uri={identity.logo} readOnly={readOnly} onPick={image('logo')} onRemove={remove('logo')} />
      </Section>

      <Section
        title="Signature ou cachet"
        hint="Une image placée à côté de « Le bailleur ». Ce n’est pas une signature électronique au sens légal.">
        <ImageField label="Signature ou cachet" uri={identity.stamp} readOnly={readOnly} onPick={image('stamp')} onRemove={remove('stamp')} />
      </Section>

      <Section title="Pied de quittance">
        {field('receiptFooter', 'Phrase en bas des quittances', 'Merci de votre confiance. Bureau ouvert du lundi au samedi.', {
          multiline: true,
          maxLength: 200,
        })}
      </Section>

      <FormError message={error} />
      {saved ? (
        <Text variant="small" tone="primary" accessibilityRole="alert">
          Identité enregistrée.
        </Text>
      ) : null}
      {!readOnly && (changed.length > 0 || colorChanged) ? (
        <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} icon={Check} disabled={saving || emailInvalid} onPress={save} />
      ) : null}
    </ScrollView>
  );
}
