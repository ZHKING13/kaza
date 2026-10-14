import { Linking } from 'react-native';

/** Ouvre WhatsApp sur la conversation du numéro, avec un message pré-rempli. */
export function openWhatsApp(e164: string, text: string) {
  const digits = e164.replace(/\D/g, '');
  return Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`);
}

export function callPhone(e164: string) {
  return Linking.openURL(`tel:${e164}`);
}
