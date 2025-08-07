import { type HybridObject } from 'react-native-nitro-modules'
import type { NitroEventSourceEvent, NitroEventSourceOptions } from '../types'

export interface NitroEventSource extends HybridObject<{ ios: 'c++', android: 'c++' }> {
    create(url: string, options?: NitroEventSourceOptions): NitroEventSource
    close(): void
    setEventCallback(callback: (event: NitroEventSourceEvent) => void): void
    addEventListener(type: string, listener: (event: NitroEventSourceEvent) => void): void
    removeEventListener(type: string, listener: (event: NitroEventSourceEvent) => void): void
}