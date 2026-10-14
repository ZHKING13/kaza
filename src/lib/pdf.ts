import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Transforme le HTML en PDF A4 et ouvre le partage (WhatsApp, e-mail, enregistrer…).
 * Sur le web, le document s'ouvre dans un nouvel onglet avec la boîte d'impression.
 */
export async function sharePdf(html: string, fileName: string): Promise<void> {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) throw new Error('popup');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  // Donne au fichier un nom lisible dans WhatsApp : « Quittance-Awa-Kone-octobre-2026.pdf »
  const target = new File(Paths.cache, `${fileName}.pdf`);
  if (target.exists) target.delete();
  new File(uri).moveSync(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName.replace(/-/g, ' ') });
}
