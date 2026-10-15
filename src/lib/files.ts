import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Partage un fichier produit sur le téléphone (WhatsApp, e-mail, enregistrer…) ; sur le web, le télécharge. */
export async function shareBytes(bytes: Uint8Array, fileName: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName.replace(/\.[a-z]+$/, '').replace(/-/g, ' ') });
}
