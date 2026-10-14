import { Text } from './Text';
import { useTheme } from '@/theme';

/** Message d'erreur d'un enregistrement (refus du serveur, absence de réseau). */
export function FormError({ message }: { message?: string }) {
  const { status } = useTheme();
  if (!message) return null;
  return (
    <Text variant="small" color={status.late.fg} accessibilityRole="alert" style={{ textAlign: 'center' }}>
      {message}
    </Text>
  );
}
