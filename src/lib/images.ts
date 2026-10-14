import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Images envoyées au serveur (logo, cachet, photo de bien) : choisies dans la galerie, réduites et
 * compressées sur le téléphone, gardées en « data URI » (elles survivent à un redémarrage tant
 * qu'elles attendent dans la file d'envoi).
 */

export type PickOptions = {
  /** Plus grand côté, en pixels */
  maxSide: number;
  /** PNG garde la transparence (logo, cachet) ; JPEG pour les photos */
  format: 'png' | 'jpeg';
  aspect?: [number, number];
};

export async function pickImage({ maxSide, format, aspect }: PickOptions): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!aspect,
    aspect,
    quality: 1,
  });
  if (res.canceled) return null;
  const { uri, width, height } = res.assets[0];
  const longest = Math.max(width || 0, height || 0);
  const resize =
    longest > maxSide ? [{ resize: width >= height ? { width: maxSide } : { height: maxSide } }] : [];
  const out = await manipulateAsync(uri, resize, {
    compress: format === 'jpeg' ? 0.7 : 1,
    format: format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG,
    base64: true,
  });
  return `data:image/${format};base64,${out.base64}`;
}

const typeOf = (uri: string) => (uri.startsWith('data:image/png') || uri.endsWith('.png') ? 'image/png' : 'image/jpeg');

/** Corps multipart (champ `file`) d'une image : data URI, fichier local, ou lien. */
export async function imageForm(uri: string, baseName: string): Promise<FormData> {
  const type = typeOf(uri);
  const name = `${baseName}.${type === 'image/png' ? 'png' : 'jpg'}`;
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, name);
    return form;
  }
  let fileUri = uri;
  if (uri.startsWith('data:')) {
    const file = new File(Paths.cache, `${Date.now()}-${name}`);
    file.write(uri.slice(uri.indexOf(',') + 1), { encoding: 'base64' });
    fileUri = file.uri;
  }
  form.append('file', { uri: fileUri, name, type } as unknown as Blob);
  return form;
}

/** Télécharge une image (lien signé) en data URI, pour l'imprimer hors ligne dans les quittances. */
export async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Clé de stockage d'un lien signé (stable tant que l'image ne change pas, contrairement au lien). */
export function storageKeyOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.split('?')[0];
  const i = path.indexOf('/org/');
  return i >= 0 ? path.slice(i + 1) : path;
}
