import { NitroModules } from 'react-native-nitro-modules';
import { ErrorEventImpl, MessageEventImpl, OpenEventImpl } from './events';
import type { NitroEventSource as NitroEventSourceSpec } from './specs/nitro-event-source.nitro';
import type { ErrorEvent, MessageEvent, NitroEventSourceEvent, NitroEventSourceOptions, OpenEvent } from './types';
import { EventSourceReadyState } from './types';

const NitroEventSource =
    NitroModules.createHybridObject<NitroEventSourceSpec>('NitroEventSource')

class EventSource {
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSED = 2;

    readonly url: string;
    readonly withCredentials: boolean;
    private _readyState: EventSourceReadyState;
    private nativeEventSource: NitroEventSourceSpec;

    onmessage: (event: MessageEvent) => void;
    onerror: (event: ErrorEvent) => void;
    onopen: (event: OpenEvent) => void;

    constructor(url: string, options?: NitroEventSourceOptions) {
        console.log('🔧 EventSource constructor: calling .create() for url:', url);
        this.nativeEventSource = NitroEventSource.create(url, options);
        this.url = url;
        this.withCredentials = options?.withCredentials ?? false;
        this._readyState = EventSourceReadyState.CONNECTING;

        this.onmessage = () => { };
        this.onerror = () => { };
        this.onopen = () => { };

        this.setupEventHandling();
    }

    get readyState(): EventSourceReadyState {
        return this._readyState;
    }


    private setupEventHandling() {
        // 1. Create a callback function that handles events
        const eventCallback = (event: NitroEventSourceEvent) => {
            this.dispatchEvent(event);
        };

        // 2. Set the callback on the native object
        this.nativeEventSource.setEventCallback(eventCallback);
    }


    dispatchEvent(event: NitroEventSourceEvent) {
        let eventObject: any;

        switch (event.type) {
            case 'message':
                if (this._readyState !== EventSourceReadyState.OPEN) {
                    this._readyState = EventSourceReadyState.OPEN;
                }
                eventObject = new MessageEventImpl(event, this as any);
                this.onmessage(eventObject);
                break;
            case 'error':
                this._readyState = EventSourceReadyState.CONNECTING; // Will retry
                eventObject = new ErrorEventImpl(event, this as any);
                this.onerror(eventObject);
                break;
            case 'open':
                this._readyState = EventSourceReadyState.OPEN;
                eventObject = new OpenEventImpl(event, this as any);
                this.onopen(eventObject);
                break;
            default:
                eventObject = {
                    type: event.type,
                    data: event.data,
                    target: this,
                    currentTarget: this,
                    lastEventId: event.id
                };
                break;
        }
    }

    addEventListener(type: string, listener: (event: NitroEventSourceEvent) => void): void {
        this.nativeEventSource.addEventListener(type, listener);
    }

    removeEventListener(type: string, listener: (event: NitroEventSourceEvent) => void): void {
        this.nativeEventSource.removeEventListener(type, listener);
    }

    close() {
        if (this._readyState === EventSourceReadyState.CLOSED) {
            return;
        }

        this._readyState = EventSourceReadyState.CLOSED;

        this.onmessage = () => { };
        this.onerror = () => { };
        this.onopen = () => { };

        this.nativeEventSource.close();
    }
}

export default EventSource;