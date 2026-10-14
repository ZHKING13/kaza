import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

const HOUSE = 'M8 22.5 22 10.8a3 3 0 0 1 3.9 0L40 22.5V38a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z';
const DOOR = 'M19 41V31a5 5 0 0 1 10 0v10Z';

/** Symbole Kaza : la case, sa porte, et la pièce du loyer. */
export function KazaMark({ size = 32, color, coin }: { size?: number; color?: string; coin?: string }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Kaza">
      <Path fillRule="evenodd" d={`${HOUSE} ${DOOR}`} fill={color ?? c.primary} />
      <Circle cx={24} cy={21.5} r={3.2} fill={coin ?? '#C2410C'} />
    </Svg>
  );
}
