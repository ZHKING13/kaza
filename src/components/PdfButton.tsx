import { FileText } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { sharePdf } from '@/lib/pdf';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

/** Génère le PDF à la demande et ouvre le partage du téléphone. */
export function PdfButton({
  label,
  html,
  fileName,
  variant = 'secondary',
}: {
  label: string;
  html: () => string;
  fileName: string;
  variant?: 'primary' | 'secondary';
}) {
  const { status } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <View style={{ gap: 4 }}>
      <Button
        label={busy ? 'Préparation du PDF…' : label}
        icon={FileText}
        variant={variant}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(undefined);
          try {
            await sharePdf(html(), fileName);
          } catch {
            setError('Le PDF n’a pas pu être créé. Réessayez dans un instant.');
          } finally {
            setBusy(false);
          }
        }}
      />
      {error ? (
        <Text variant="small" color={status.late.fg}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
