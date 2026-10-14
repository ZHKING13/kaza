import { formatAmount, formatNumber } from '@/lib/format';

import { Text } from './Text';

type Props = React.ComponentProps<typeof Text> & { value: number; currency?: boolean };

/** Montant en chiffres tabulaires. `currency={false}` affiche le nombre seul. */
export function Amount({ value, currency = true, variant = 'bodyStrong', ...rest }: Props) {
  return (
    <Text variant={variant} {...rest}>
      {currency ? formatAmount(value) : formatNumber(value)}
    </Text>
  );
}
