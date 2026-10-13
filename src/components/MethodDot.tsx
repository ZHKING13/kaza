import { View } from 'react-native';

import { methods } from '@/data/methods';
import type { PaymentMethod } from '@/data/types';

export function MethodDot({ method, size = 8 }: { method: PaymentMethod; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: methods[method].color }} />;
}
