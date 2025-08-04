import { NitroModules } from 'react-native-nitro-modules'
import type { NitroEventSource as NitroEventSourceSpec } from './specs/nitro-event-source.nitro'

export const NitroEventSource =
  NitroModules.createHybridObject<NitroEventSourceSpec>('NitroEventSource')