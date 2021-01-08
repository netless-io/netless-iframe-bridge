import {InvisiblePlugin, Event, RoomState, InvisiblePluginContext, Displayer, Room, DisplayerState, AnimationMode, PlayerPhase} from "white-web-sdk";
import {EventEmitter2} from "eventemitter2";

export type IframeBridgeAttributes = {
    readonly url: string;
    readonly width: number;
    readonly height: number;
    readonly displaySceneDir: string;
};

export type IframeSize = {
    readonly width: number;
    readonly height: number;
};

export type InsertOptions = {
    readonly room: Room;
} & BaseOption;

type BaseOption = {
    readonly url: string;
    readonly width: number;
    readonly height: number;
    readonly displaySceneDir: string;
};

type OnCreateInsertOption = {
    readonly displayer: Displayer;
} & BaseOption;

export enum IframeEvents {
    Init = "Init",
    AttributesUpdate = "AttributesUpdate",
    SetAttributes = "SetAttributes",
    RegisterMagixEvent = "RegisterMagixEvent",
    RemoveMagixEvent = "RemoveMagixEvent",
    RemoveAllMagixEvent = "RemoveAllMagixEvent",
    RoomStateChanged = "RoomStateChanged",
    DispatchMagixEvent = "DispatchMagixEvent",
    ReciveMagixEvent = "ReciveMagixEvent",
    NextPage = "NextPage",
    PrevPage = "PrevPage",
    SDKCreate = "SDKCreate",
}

export enum DomEvents {
    WrapperDidMount = "WrapperDidMount",
    IframeLoad = "IframeLoad",
}

export class IframeBridge extends InvisiblePlugin<IframeBridgeAttributes> {

    public static readonly kind: string = "IframeBridge";
    private static readonly hiddenClass: string = "netless-iframe-brdige-hidden";
    public static emitter: EventEmitter2 = new EventEmitter2();
    private static displayer: Displayer;
    private styleDom: HTMLStyleElement | null = null;
    private static alreadyCreate: boolean = false;

    public iframe: HTMLIFrameElement | null = null;
    private readonly magixEventMap: Map<string, (event: Event) => void> = new Map();
    private cssList: string[] = [];

    public constructor(context: InvisiblePluginContext) {
        super(context);
        IframeBridge.displayer = context.displayer;
    }

    public static onCreate(plugin: IframeBridge): void {
        const attributes = plugin.attributes;
        if (attributes.url && attributes.height && attributes.width) {
            if (!IframeBridge.alreadyCreate) {
                plugin.insertByOnCreate({ ...attributes, displayer: this.displayer });
            }
        }
    }

    public onAttributesUpdate(attributes: IframeBridgeAttributes): void {
        if (this.attributes.url !== attributes.url) {
            this.listenIframe(this.attributes);
        }
        if (attributes.displaySceneDir) {
            this.computedIframeDisplay(this.displayer.state, attributes);
        }
        this.postMessage({ kind: IframeEvents.AttributesUpdate, payload: attributes });
    }

    public onDestroy(): void {
        this._destory();
    }

    public static async insert(options: InsertOptions): Promise<IframeBridge> {
        const plugin = options.room.getInvisiblePlugin(IframeBridge.kind);
        if (plugin) {
            throw new Error("plugin already inserted, can't re-insert");
        }
        const initAttributes: IframeBridgeAttributes = {
            url: options.url,
            width: options.width,
            height: options.height,
            displaySceneDir: options.displaySceneDir,
        };
        IframeBridge.alreadyCreate = true;
        const instance: any = await options.room.createInvisiblePlugin(IframeBridge as any, initAttributes);
        instance.baseInsert(options);
        return instance;
    }

    public insertByOnCreate(options: OnCreateInsertOption): void {
        const instance = (options.displayer as any).getInvisiblePlugin(IframeBridge.kind);
        instance.baseInsert(options);
    }

    public baseInsert(options: BaseOption): IframeBridge {
        const wrapperDidMountListener = () => {
            this.getIframe();
            this.listenIframe(options);
            this.listenDisplayerState();
        };
        if (this.getIframe()) {
            wrapperDidMountListener();
        } else {
            IframeBridge.emitter.once(DomEvents.WrapperDidMount, wrapperDidMountListener);
        }
        this.injectCss();
        return this;
    }

    public setAttributes(payload: any): void {
        this.ensureNotReadonly();
        if (payload.url) {
            this.listenIframe(Object.assign(this.attributes, payload));
        }
        if (payload.displaySceneDir) {
            this.computedIframeDisplay(this.displayer.state, Object.assign(this.attributes, payload));
        }
        super.setAttributes(payload);
    }

    public destroy(): void {
        this._destory();
        super.destroy();
    }

    private getIframe(): HTMLIFrameElement {
        const iframe = document.getElementById(IframeBridge.kind) as HTMLIFrameElement;
        this.iframe = iframe;
        return iframe;
    }

    public setIframeSize(params: IframeSize): void {
        if (this.iframe) {
            this.iframe.width = `${params.width}px`;
            this.iframe.height = `${params.height}px`;
            this.setAttributes({ width: params.width, height: params.height });
        }
    }

    public scaleIframeToFit(animationMode: AnimationMode = AnimationMode.Immediately): void {
        const x = - this.attributes.width / 2;
        const y = - this.attributes.height / 2;
        const width = this.attributes.width;
        const height = this.attributes.height;

        this.displayer.moveCameraToContain({
            originX: x,
            originY: y,
            width,
            height,
            animationMode,
        });
    }

    private listenIframe(options: BaseOption): void {
        const iframe = document.getElementById(IframeBridge.kind) as HTMLIFrameElement;
        const loadListener = (ev: globalThis.Event) => {
            this.postMessage({ kind: IframeEvents.Init, payload: {
                attributes: this.attributes,
                roomState: IframeBridge.displayer.state,
            }});
            IframeBridge.emitter.emit(DomEvents.IframeLoad, ev);
        };
        if (iframe.src) {
            window.removeEventListener("message", this.messageListener);
            iframe.removeEventListener("load", loadListener);
        }
        this.iframe = iframe;
        iframe.src = options.url;
        iframe.width = options.width + "px";
        iframe.height = options.height + "px";
        window.addEventListener("message", this.messageListener.bind(this));
        iframe.addEventListener("load", loadListener);
    }

    private listenDisplayerState(): void {
        if (this.isReplay) {
            let firstPlay = false;
            this.displayer.callbacks.on("onPhaseChanged", (phase: PlayerPhase) => {
                if (phase === PlayerPhase.Playing) {
                    if (!firstPlay) {
                        this.computedStyle(this.displayer.state);
                        this.computedIframeDisplay(this.displayer.state, this.attributes);
                    }
                    firstPlay = true;
                }
            });
        } else {
            this.computedStyle(this.displayer.state);
            this.computedIframeDisplay(this.displayer.state, this.attributes);
            const callbackName = this.isReplay ? "onReplayStateChanged" : "onRoomStateChanged";
            this.displayer.callbacks.on(callbackName as any, (state: RoomState) => {
                this.postMessage({ kind: IframeEvents.RoomStateChanged, payload: state });
                if (state.cameraState) {
                    this.computedStyle(this.displayer.state);
                }
                if (state.memberState) {
                    this.computedZindex();
                    this.updateStyle();
                }
                if (state.sceneState) {
                    this.computedIframeDisplay(state, this.attributes);
                }
            });
        }
    }

    private computedStyle(state: DisplayerState): void {
        const cameraState = state.cameraState;
        if (this.iframe) {
            const {width, height, scale, centerX, centerY} = cameraState;
            const position = "position: absolute;";
            const borderWidth = "border-width: 0px;";
            const transformOriginX = `${(width / 2)}px`;
            const transformOriginY = `${(height / 2)}px`;
            const left = `left: 0px;`;
            const top = `top: 0px;`;
            const transformOrigin = `transform-origin: ${transformOriginX} ${transformOriginY};`;
            const iframeXDiff = ((width - this.attributes.width) / 2) * scale;
            const iframeYDiff = ((height - this.attributes.height) / 2) * scale;
            const x =  - (centerX * scale) + iframeXDiff;
            const y = - (centerY * scale) + iframeYDiff;
            const transform = `transform: translate(${x}px,${y}px) scale(${scale}, ${scale});`;
            const cssList = [position, borderWidth, top, left, transformOrigin, transform];
            this.cssList = cssList;
            this.computedZindex();
            this.updateStyle();
        }
    }

    private computedIframeDisplay(state: DisplayerState, attributes: IframeBridgeAttributes): void {
        if (this.iframe) {
            if (!state.sceneState.scenePath.startsWith(attributes.displaySceneDir)) {
                this.iframe.classList.add(IframeBridge.hiddenClass);
            } else {
                this.iframe.classList.remove(IframeBridge.hiddenClass);
            }
        }
    }

    private computedZindex(): void {
        const zIndexString = "z-index: -1;";
        const index = this.cssList.findIndex(css => css === zIndexString);
        if (index !== -1) {
            this.cssList.splice(index, 1);
        }
        if (!this.isSelector()) {
            this.cssList.push(zIndexString);
        }
    }

    private updateStyle(): void {
        if (this.iframe) {
            this.iframe.style.cssText = this.cssList.join(" ");
        }
    }

    private messageListener(event: MessageEvent): void {
        if (event.origin !== this.iframeOrigin) {
            console.warn(`message origin: ${event.origin} not current iframe origin`);
            return;
        }
        const data = event.data;
        switch (data.kind) {
            case IframeEvents.SetAttributes: {
                this.handleSetAttributes(data);
                break;
            }
            case IframeEvents.RegisterMagixEvent: {
                this.handleRegisterMagixEvent(data);
                break;
            }
            case IframeEvents.RemoveMagixEvent: {
                this.handleRemoveMagixEvent(data);
                break;
            }
            case IframeEvents.DispatchMagixEvent: {
                this.handleDispatchMagixEvent(data);
                break;
            }
            case IframeEvents.RemoveAllMagixEvent: {
                this.handleRemoveAllMagixEvent();
                break;
            }
            case IframeEvents.NextPage: {
                this.handleNextPage();
                break;
            }
            case IframeEvents.PrevPage: {
                this.handlePrevPage();
                break;
            }
            case IframeEvents.SDKCreate: {
                this.handleSDKCreate();
                break;
            }
            default: {
                console.warn(`${data.kind} not allow event.`);
                break;
            }
        }
    }

    private handleSDKCreate(): void {
        this.postMessage({ kind: IframeEvents.Init, payload: {
            attributes: this.attributes,
            roomState: IframeBridge.displayer.state,
        }});
    }

    private handleDispatchMagixEvent(data: any): void {
        const eventPayload = data.payload;
        this.dispatchMagixEvent(eventPayload.event, eventPayload.payload);
    }

    private handleSetAttributes(data: any): void {
        this.setAttributes(data.payload);
    }

    private handleRegisterMagixEvent(data: any): void {
        const eventName = data.payload as string;
        const listener = (event: Event) => {
            if (event.authorId === this.displayer.observerId) {
                return;
            }
            this.postMessage({ kind: IframeEvents.ReciveMagixEvent, payload: event });
        };
        this.magixEventMap.set(eventName, listener);
        this.displayer.addMagixEventListener(eventName, listener);
    }

    private handleRemoveMagixEvent(data: any): void {
        const eventName = data.payload as string;
        const listener = this.magixEventMap.get(eventName);
        this.displayer.removeMagixEventListener(eventName, listener);
    }

    private handleNextPage(): void {
        this.ensureNotReadonly();
        const nextPageNum = this.currentPage + 1;
        if (nextPageNum > this.totalPage) {
            return;
        }
        (this.displayer as any).setSceneIndex(nextPageNum - 1);
        this.dispatchMagixEvent(IframeEvents.NextPage, {});
    }

    private handlePrevPage(): void {
        this.ensureNotReadonly();
        const prevPageNum = this.currentPage - 1;
        if (prevPageNum < 0) {
            return;
        }
        (this.displayer as any).setSceneIndex(prevPageNum - 1);
        this.dispatchMagixEvent(IframeEvents.PrevPage, {});
    }

    private handleRemoveAllMagixEvent(): void {
        this.magixEventMap.forEach((listener, event) => {
            this.displayer.removeMagixEventListener(event, listener);
        });
        this.magixEventMap.clear();
    }

    private postMessage(message: any): void {
        if (this.iframe) {
            this.iframe.contentWindow?.postMessage(message, "*");
        }
    }

    private dispatchMagixEvent(event: string, payload: any): void {
        this.ensureNotReadonly();
        (this.displayer as any).dispatchMagixEvent(event, payload);
    }

    private get currentIndex(): number {
        return this.displayer.state.sceneState.index;
    }

    private get currentPage(): number {
        return this.currentIndex + 1;
    }

    private get totalPage(): number {
        return this.displayer.state.sceneState.scenes.length;
    }

    private get readonly(): boolean {
        return !(this.displayer as any).isWritable;
    }

    private get isReplay(): boolean {
        return "isPlayable" in (this.displayer as any);
    }

    private ensureNotReadonly(): void {
        if (this.readonly) {
            throw new Error("readOnly mode cannot invoke this method");
        }
    }

    private isSelector(): boolean {
        if (this.readonly) {
            return false;
        }
        return (this.displayer as Room).state.memberState.currentApplianceName === "selector";
    }

    private get iframeOrigin (): string {
        const url = new URL(this.iframe!.src);
        return url.origin;
    }

    private injectCss(): void {
        const styleDom = document.createElement("style");
        const styleStr = `
            .${IframeBridge.hiddenClass} {
                display: none;
            }
        `;
        this.styleDom = styleDom;
        styleDom.appendChild(document.createTextNode(styleStr));
        document.getElementsByTagName("head")[0].appendChild(styleDom);
    }

    private _destory(): void {
        window.removeEventListener("message", this.messageListener);
        this.magixEventMap.forEach((listener, event) => {
            this.displayer.removeMagixEventListener(event, listener);
        });
        this.magixEventMap.clear();
        if (this.iframe) {
            this.iframe.parentNode?.removeChild(this.iframe);
            this.iframe = null;
        }
        if (this.styleDom) {
            this.styleDom.parentNode?.removeChild(this.styleDom);
        }
    }
}

export * from "./iframeWrapper";
