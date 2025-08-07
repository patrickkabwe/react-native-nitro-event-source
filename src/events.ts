import type { ErrorEvent, MessageEvent, NitroEventSourceEvent, OpenEvent } from './types';


// Create a proper EventSource-compatible MessageEvent class
export class MessageEventImpl implements MessageEvent {
    readonly type: 'message' = 'message';
    readonly data: string;
    readonly origin: string;
    readonly lastEventId: string;
    readonly source: null = null;
    readonly ports: never[] = [];

    // Event properties
    readonly isTrusted: boolean = true;
    readonly bubbles: boolean = false;
    readonly cancelable: boolean = false;
    readonly composed: boolean = false;
    readonly currentTarget: EventSource;
    readonly srcElement: EventSource;
    readonly target: EventSource;
    readonly timeStamp: number;
    readonly userActivation: null = null;

    // Mutable event properties
    private _cancelBubble: boolean = false;
    private _defaultPrevented: boolean = false;
    private _returnValue: boolean = true;
    private _eventPhase: 0 | 2 = 0;



    constructor(event: NitroEventSourceEvent, eventSource: EventSource) {
        this.data = event.data;
        this.origin = new URL(eventSource.url).origin;
        this.lastEventId = event.id;
        this.currentTarget = eventSource;
        this.srcElement = eventSource;
        this.target = eventSource;
        this.timeStamp = performance.now();
    }

    get cancelBubble(): boolean { return this._cancelBubble; }
    set cancelBubble(value: boolean) { this._cancelBubble = value; }

    get defaultPrevented(): boolean { return this._defaultPrevented; }
    get eventPhase(): 0 | 2 { return this._eventPhase; }
    get returnValue(): boolean { return this._returnValue; }
    set returnValue(value: boolean) { this._returnValue = value; }

    preventDefault(): void {
        if (this.cancelable) {
            this._defaultPrevented = true;
            this._returnValue = false;
        }
    }

    stopPropagation(): void {
        // For EventSource, this doesn't do much but matches the interface
    }

    stopImmediatePropagation(): void {
        // For EventSource, this doesn't do much but matches the interface
    }
}


export class ErrorEventImpl implements ErrorEvent {
    readonly type: 'error' = 'error';
    readonly data: string;
    readonly isTrusted: boolean = true;
    readonly bubbles: boolean = false;
    readonly cancelable: boolean = false;
    readonly composed: boolean = false;
    readonly defaultPrevented: boolean = false;
    readonly eventPhase: 0 | 2 = 0;
    readonly returnValue: boolean = true;
    readonly target: EventSource;
    readonly currentTarget: EventSource;
    readonly srcElement: EventSource;
    readonly lastEventId: string;
    readonly timeStamp: number;
    private _cancelBubble: boolean = false;

    constructor(event: NitroEventSourceEvent, eventSource: EventSource) {
        this.data = event.data;
        this.target = eventSource;
        this.lastEventId = event.id;
        this.currentTarget = eventSource;
        this.srcElement = eventSource;
        this.timeStamp = performance.now();
    }

    get cancelBubble(): boolean { return this._cancelBubble; }
    set cancelBubble(value: boolean) { this._cancelBubble = value; }

    preventDefault(): void {
        // Error events are typically not cancelable
    }

    stopPropagation(): void { }

    stopImmediatePropagation(): void { }
}

// Open Event implementation
export class OpenEventImpl implements OpenEvent {
    readonly type: 'open' = 'open';
    readonly data: string;
    readonly isTrusted: boolean = true;
    readonly bubbles: boolean = false;
    readonly cancelable: boolean = false;
    readonly composed: boolean = false;
    readonly defaultPrevented: boolean = false;
    readonly eventPhase: 0 | 2 = 0;
    readonly returnValue: boolean = true;
    readonly target: EventSource;
    readonly currentTarget: EventSource;
    readonly srcElement: EventSource;
    readonly lastEventId: string;
    readonly timeStamp: number;
    private _cancelBubble: boolean = false;

    constructor(event: NitroEventSourceEvent, eventSource: EventSource) {
        this.data = event.data;
        this.lastEventId = event.id;
        this.target = eventSource;
        this.currentTarget = eventSource;
        this.srcElement = eventSource;
        this.timeStamp = performance.now();
    }

    get cancelBubble(): boolean { return this._cancelBubble; }
    set cancelBubble(value: boolean) { this._cancelBubble = value; }

    preventDefault(): void {
        // Open events are typically not cancelable
    }

    stopPropagation(): void { }

    stopImmediatePropagation(): void { }
}
