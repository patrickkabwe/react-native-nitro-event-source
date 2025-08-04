import { type HybridObject } from 'react-native-nitro-modules'

export interface NitroEventSource extends HybridObject<{ ios: 'c++', android: 'c++' }> {
  sum(num1: number, num2: number): number
}