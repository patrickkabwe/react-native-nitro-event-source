
export interface NitroEventSourceOptions {
    withCredentials?: boolean
    headers?: Record<string, string>
    rawMode?: boolean
}

export interface NitroEventSourceEvent {
    id: string
    type: string
    data: string
}


export enum EventSourceReadyState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSED = 2
}

export interface MessageEvent {
    readonly type: 'message';
    readonly data: string;
    readonly origin: string;
    readonly lastEventId: string;
    readonly source: null;
    readonly ports: never[];
    readonly isTrusted: boolean;
    readonly bubbles: boolean;
    readonly cancelBubble: boolean;
    readonly cancelable: boolean;
    readonly composed: boolean;
    readonly currentTarget: EventSource;
    readonly defaultPrevented: boolean;
    readonly eventPhase: 0 | 2;
    readonly returnValue: boolean;
    readonly srcElement: EventSource;
    readonly target: EventSource;
    readonly timeStamp: number;
    readonly userActivation: null;
    preventDefault(): void;
    stopPropagation(): void;
    stopImmediatePropagation(): void;
}


export interface ErrorEvent {
    readonly type: 'error';
    readonly data: string;
    readonly isTrusted: boolean;
    readonly bubbles: boolean;
    readonly eventPhase: 0 | 2;
    readonly cancelable: boolean;
    readonly composed: boolean;
    readonly defaultPrevented: boolean;
    readonly returnValue: boolean;
    readonly target: EventSource;
    readonly currentTarget: EventSource;
    readonly srcElement: EventSource;
    readonly timeStamp: number;
    cancelBubble: boolean;
    preventDefault(): void;
    stopPropagation(): void;
    stopImmediatePropagation(): void;
}

export interface OpenEvent {
    readonly type: 'open';
    readonly data: string;
    readonly isTrusted: boolean;
    readonly bubbles: boolean;
    readonly eventPhase: 0 | 2;
    readonly cancelable: boolean;
    readonly composed: boolean;
    readonly defaultPrevented: boolean;
    readonly returnValue: boolean;
    readonly target: EventSource;
    readonly currentTarget: EventSource;
    readonly srcElement: EventSource;
    readonly timeStamp: number;
    cancelBubble: boolean;
    preventDefault(): void;
    stopPropagation(): void;
    stopImmediatePropagation(): void;
}
