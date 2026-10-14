import * as ImagePicker from 'expo-image-picker';
import { Check, ImagePlus, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Chip } from './Chip';
import { FormError } from './FormError';
import { errorMessage } from '@/lib/api';
import { Text } from './Text';
import { TextField } from './TextField';
import { draftKey, type UnitDraft, UnitsEditor } from './UnitsEditor';
import { propertyTypeOrder, propertyTypes } from '@/data/propertyTypes';
import { countries, splitPhone } from '@/data/countries';
import { useStore } from '@/data/store';
import type { PropertyType } from '@/data/types';
import { formatNumber } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';

function Section({ title, optional, children }: { title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="h3" accessibilityRole="header">
        {title}
        {optional ? (
          <Text variant="small" tone="muted">
            {'  '}facultatif
          </Text>
        ) : null}
      </Text>
      {children}
    </View>
  );
}

/** Formulaire de création d'un bien, utilisé par « Nouveau bien » et par l'onboarding. */
export function PropertyForm({
  onSaved,
  submitLabel = 'Enregistrer le bien',
  compact = false,
}: {
  onSaved: (propertyId: string) => void | Promise<void>;
  submitLabel?: string;
  /** Onboarding : sans photo ni description, à compléter plus tard */
  compact?: boolean;
}) {
  const { c, status } = useTheme();
  const insets = useSafeAreaInsets();
  const { addProperty, profile } = useStore();
  // Ville proposée selon le pays du numéro du bailleur ; ses voisines ensuite
  const homeCountry = splitPhone(profile.phone || '', countries[0]).country;
  const CITIES = [homeCountry.city, ...countries.map((x) => x.city).filter((x) => x !== homeCountry.city)];

  const [name, setName] = useState('');
  const [type, setType] = useState<PropertyType | null>(null);
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState<string>(homeCountry.city);
  const [rent, setRent] = useState(0);
  const [units, setUnits] = useState<UnitDraft[]>([{ key: draftKey(), label: '', rent: 0 }]);
  const [photo, setPhoto] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const single = type ? propertyTypes[type].singleUnit : false;

  const chooseType = (t: PropertyType) => {
    setType(t);
    // Pré-remplit le nom de la première unité tant que l'utilisateur n'y a pas touché
    if (units.length === 1 && !units[0].label && !units[0].rent) {
      setUnits([{ ...units[0], label: propertyTypes[t].singleUnit ? '' : propertyTypes[t].defaultUnit }]);
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.6,
    });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  const errors = {
    name: !name.trim() ? 'Donnez un nom au bien, par exemple « Cour de Yopougon ».' : undefined,
    type: !type ? 'Choisissez le type de bien.' : undefined,
    district: !district.trim() ? 'Indiquez le quartier.' : undefined,
    city: !city.trim() ? 'Indiquez la ville.' : undefined,
    rent: single && rent <= 0 ? 'Indiquez le loyer mensuel.' : undefined,
    units:
      !single && units.some((u) => !u.label.trim() || u.rent <= 0) ? 'Chaque unité doit avoir un nom et un loyer.' : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (e?: string) => (submitted ? e : undefined);

  const save = async () => {
    setSubmitted(true);
    if (!valid || !type || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const id = await addProperty(
        {
          name: name.trim(),
          type,
          district: district.trim(),
          city: city.trim(),
          photo,
          description: description.trim() || undefined,
        },
        single ? [{ label: propertyTypes[type].defaultUnit, rent }] : units.map((u) => ({ label: u.label, rent: u.rent })),
      );
      await onSaved(id);
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.xl, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled">
        <Section title="Le bien">
          <TextField
            label="Nom du bien"
            value={name}
            onChangeText={setName}
            placeholder="Ex. Cour de Yopougon, Villa Riviera"
            error={show(errors.name)}
            autoCapitalize="words"
          />
          <View style={{ gap: 6 }}>
            <Text variant="label" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
              Type de bien
            </Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {propertyTypeOrder.map((t) => {
                const meta = propertyTypes[t];
                const on = type === t;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => chooseType(t)}
                    style={{
                      flexBasis: '48%',
                      flexGrow: 1,
                      minHeight: 88,
                      padding: space.sm,
                      gap: 4,
                      borderRadius: radius.md,
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? c.primary : show(errors.type) ? status.late.fg : c.border,
                      backgroundColor: on ? c.primarySoft : c.surface,
                    }}>
                    <meta.icon size={22} color={on ? c.primary : c.textMuted} />
                    <Text variant="bodyStrong" color={on ? c.primary : c.text}>
                      {meta.label}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {meta.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {show(errors.type) ? (
              <Text variant="small" color={status.late.fg}>
                {errors.type}
              </Text>
            ) : null}
          </View>
        </Section>

        <Section title="Emplacement">
          <TextField
            label="Quartier"
            icon={MapPin}
            value={district}
            onChangeText={setDistrict}
            placeholder="Ex. Yopougon Selmer, derrière la pharmacie"
            helper="Ajoutez un repère si l’adresse n’a pas de nom de rue."
            error={show(errors.district)}
          />
          <TextField label="Ville" value={city} onChangeText={setCity} error={show(errors.city)} autoCapitalize="words" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {CITIES.map((v) => (
              <Chip key={v} label={v} selected={city === v} onPress={() => setCity(v)} />
            ))}
          </View>
        </Section>

        {type ? (
          single ? (
            <Section title="Loyer">
              <TextField
                label="Loyer mensuel"
                value={rent ? formatNumber(rent) : ''}
                onChangeText={(t) => setRent(Number(t.replace(/\D/g, '')) || 0)}
                keyboardType="number-pad"
                placeholder="0"
                suffix="FCFA"
                error={show(errors.rent)}
                style={{ fontVariant: ['tabular-nums'] }}
              />
            </Section>
          ) : (
            <Section title="Unités">
              <Text variant="small" tone="muted">
                Saisissez la première unité, puis « Dupliquer » pour les suivantes. Vous pourrez en ajouter plus tard.
              </Text>
              <UnitsEditor value={units} onChange={setUnits} />
              {show(errors.units) ? (
                <Text variant="small" color={status.late.fg}>
                  {errors.units}
                </Text>
              ) : null}
            </Section>
          )
        ) : null}

        {compact ? null : (
          <>
            <Section title="Photo" optional>
              {photo ? (
                <View style={{ gap: space.xs }}>
                  <Image
                    source={{ uri: photo }}
                    style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md }}
                    accessibilityLabel="Photo du bien"
                  />
                  <View style={{ flexDirection: 'row', gap: space.xs }}>
                    <Button label="Changer" variant="secondary" style={{ flex: 1 }} onPress={pickPhoto} />
                    <Button label="Retirer" variant="ghost" onPress={() => setPhoto(undefined)} />
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={pickPhoto}
                  style={({ pressed }) => ({
                    minHeight: 96,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: c.border,
                    backgroundColor: pressed ? c.surfaceAlt : c.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: space.md,
                  })}>
                  <ImagePlus size={26} color={c.primary} />
                  <Text variant="bodyStrong" tone="primary">
                    Ajouter une photo
                  </Text>
                  <Text variant="caption" tone="muted">
                    Sans photo, Kaza affiche une illustration.
                  </Text>
                </Pressable>
              )}
            </Section>

            <Section title="Description" optional>
              <TextField
                label="Notes sur le bien"
                value={description}
                onChangeText={setDescription}
                placeholder="Compteurs, équipements, repères…"
                multiline
              />
            </Section>
          </>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
          gap: 6,
        }}>
        {submitted && !valid ? (
          <Text variant="small" color={status.late.fg} style={{ textAlign: 'center' }}>
            Complétez les champs signalés en rouge.
          </Text>
        ) : null}
        <FormError message={saveError} />
        <Button label={saving ? 'Enregistrement…' : submitLabel} icon={Check} haptic onPress={save} disabled={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}
