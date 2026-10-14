import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from './Button';
import { FormError } from './FormError';
import { Text } from './Text';
import { errorMessage } from '@/lib/api';
import { useTheme } from '@/theme';

/** Bouton qui fait envoyer un message par Kaza, avec son état (envoi, envoyé, erreur). */
export function KazaSendButton({
  label,
  sentLabel,
  send,
  variant = 'secondary',
  onSent,
}: {
  label: string;
  sentLabel: string;
  send: () => Promise<unknown>;
  variant?: 'primary' | 'secondary';
  onSent?: () => void;
}) {
  const { status } = useTheme();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string>();

  const press = async () => {
    setState('sending');
    setError(undefined);
    try {
      await send();
      setState('sent');
      onSent?.();
    } catch (e) {
      setState('idle');
      setError(errorMessage(e));
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Button
        label={state === 'sending' ? 'Envoi…' : label}
        icon={Send}
        variant={variant}
        disabled={state !== 'idle'}
        onPress={press}
      />
      {state === 'sent' ? (
        <Text variant="small" color={status.paid.fg} accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {sentLabel}
        </Text>
      ) : null}
      <FormError message={error} />
    </View>
  );
}
