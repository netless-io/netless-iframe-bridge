import {InvisiblePlugin, Event, RoomState, InvisiblePluginContext, Displayer, Room, DisplayerState, AnimationMode, PlayerPhase, RoomPhase, isPlayer} from "white-web-sdk";
import {EventEmitter2} from "eventemitter2";
import {times} from "./utils";

export type IframeBridgeAttributes = {
    readonly url: string;
    readonly width: number;
    readonly height: number;
    readonly displaySceneDir: string;
    readonly lastEvent?: { name: string, payload: any };
    readonly useClicker?: boolean;
    readonly useSelector?: boolean;
};

export type IframeSize = {
    readonly width: number;
    readonly height: number;
};

export type InsertOptions = {
    readonly room: Room;
    readonly useClicker?: boolean;
    readonly useSelector?: boolean;
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
    OnCreate = "OnCreate",
    SetPage = "SetPage",
    GetAttributes = "GetAttributes",
    Ready = "Ready",
    Destory = "Destory",
    StartCreate = "StartCreate",
    WrapperDidUpdate = "WrapperDidUpdate",
    DispayIframe = "DispayIframe",
    HideIframe = "HideIframe",
    PageTo = "PageTo",
}

export enum DomEvents {
    WrapperDidMount = "WrapperDidMount",
    IframeLoad = "IframeLoad",
}

const position = "position: absolute;";
// 在某些安卓机型, border-width 不为 0 时，才能正确计算 iframe 里嵌套 iframe 的大小
const borderWidth = "border: 0.1px solid rgba(0,0,0,0);";
const left = `left: 0px;`;
const top = `top: 0px;`;

export class IframeBridge extends InvisiblePlugin<IframeBridgeAttributes> {

    public static readonly kind: string = "IframeBridge";
    public static emitter: EventEmitter2 = new EventEmitter2();
    private static displayer: Displayer;
    private static alreadyCreate: boolean = false;

    public iframe: HTMLIFrameElement | null = null;
    private readonly magixEventMap: Map<string, (event: Event) => void> = new Map();
    private cssList: string[] = [];
    private allowAppliances = ["clicker"];

    public constructor(context: InvisiblePluginContext) {
        super(context);
        IframeBridge.displayer = context.displayer;
    }

    public static onCreate(plugin: IframeBridge): void {
        IframeBridge.emitter.emit(IframeEvents.StartCreate);
        const attributes = plugin.attributes;
        if (attributes.url && attributes.height && attributes.width) {
            if (!IframeBridge.alreadyCreate) {
                plugin.insertByOnCreate({ ...attributes, displayer: this.displayer });
            }
        }
        IframeBridge.emitter.emit(IframeEvents.OnCreate, plugin);
    }

    public onAttributesUpdate(attributes: IframeBridgeAttributes): void {
        if (attributes.url) {
            const iframeSrc = this.iframe?.src;
            if (iframeSrc && iframeSrc !== attributes.url) {
                this.listenIframe(attributes);
            }
        }
        if (attributes.displaySceneDir) {
            this.computedIframeDisplay(this.displayer.state, attributes);
        }
        if (attributes.width || attributes.height) {
            if (this.iframe) {
                this.iframe.width = `${attributes.width}px`;
                this.iframe.height = `${attributes.height}px`;
            }
        }
        this.postMessage({ kind: IframeEvents.AttributesUpdate, payload: attributes });
    }

    public onDestroy(): void {
        this._destory();
    }

    public static async insert(options: InsertOptions): Promise<IframeBridge> {
        const plugin = options.room.getInvisiblePlugin(IframeBridge.kind);
        if (plugin) {
            console.warn("plugin already inserted, can't re-insert");
            return plugin as any;
        }
        const initAttributes: IframeBridgeAttributes = {
            url: options.url,
            width: options.width,
            height: options.height,
            displaySceneDir: options.displaySceneDir,
            useClicker: options.useClicker || false,
            useSelector: options.useSelector,
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
            IframeBridge.emitter.once(IframeEvents.WrapperDidUpdate, wrapperDidMountListener);
        }
        if (this.attributes.useSelector) {
            this.allowAppliances.push("selector");
        }
        this.computedStyle(this.displayer.state);
        this.listenDisplayerCallbacks();
        this.getComputedIframeStyle();
        window.addEventListener("message", this.messageListener.bind(this));
        return this;
    }

    // 在某些安卓机型中会遇到 iframe 嵌套计算 bug，需要手动延迟触发一下重绘
    private getComputedIframeStyle(): void {
        setTimeout(() => {
            if (this.iframe) {
                getComputedStyle(this.iframe);
            }
        }, 200);
    }

    public setAttributes(payload: any): void {
        if (this.canOperation) {
            if (payload.url) {
                this.listenIframe(Object.assign(this.attributes, payload));
            }
            if (payload.displaySceneDir) {
                this.computedIframeDisplay(this.displayer.state, Object.assign(this.attributes, payload));
            }
            super.setAttributes(payload);
        }
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
        if (!this.inDisplaySceneDir) {
            return;
        }
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

    private handleSetPage(data: any): void {
        if (this.isReplay) {
            return;
        }
        const page = data.payload;
        const room = this.displayer as Room;
        const scenes = room.entireScenes()[this.attributes.displaySceneDir];
        if (!scenes || scenes.length !== page) {
            const genScenes = times<{ name: string }>(page, (index: number) => ({ name: String(index + 1) }));
            room.putScenes(this.attributes.displaySceneDir, genScenes);
            room.setScenePath(this.attributes.displaySceneDir);
        }
    }

    private listenIframe(options: BaseOption): void {
        const iframe = document.getElementById(IframeBridge.kind) as HTMLIFrameElement;
        const loadListener = (ev: globalThis.Event) => {
            this.postMessage({ kind: IframeEvents.Init, payload: {
                attributes: this.attributes,
                roomState: IframeBridge.displayer.state,
                currentPage: this.currentPage,
                observerId: this.displayer.observerId
            }});
            IframeBridge.emitter.emit(DomEvents.IframeLoad, ev);
            IframeBridge.emitter.on(IframeEvents.Ready, () => {
                this.postMessage(this.attributes.lastEvent?.payload);
            });
            this.computedStyleAndIframeDisplay();
        };
        if (iframe.src) {
            iframe.removeEventListener("load", loadListener);
        }
        this.iframe = iframe;
        iframe.src = options.url;
        iframe.width = options.width + "px";
        iframe.height = options.height + "px";
        iframe.addEventListener("load", loadListener);
    }

    private onPhaseChangedListener = (phase: PlayerPhase) => {
        if (phase === PlayerPhase.Playing) {
            this.computedStyleAndIframeDisplay();
        }
    }

    private listenDisplayerState(): void {
        if (this.isReplay) {
            let firstPlay = false;
            if ((this.displayer as any)._phase === PlayerPhase.Playing) {
                this.computedStyleAndIframeDisplay();
                firstPlay = true;
            }
            this.displayer.callbacks.on("onPhaseChanged", this.onPhaseChangedListener);
        }
        this.computedStyleAndIframeDisplay();
    }



    private computedStyleAndIframeDisplay(): void {
        this.computedStyle(this.displayer.state);
        this.computedIframeDisplay(this.displayer.state, this.attributes);
    }

    private listenDisplayerCallbacks(): void {
        this.displayer.callbacks.on(this.callbackName as any, this.stateChangeListener);
    }

    private get callbackName(): string {
        return this.isReplay ? "onPlayerStateChanged" : "onRoomStateChanged";
    }

    private stateChangeListener = (state: RoomState) => {
        this.postMessage({ kind: IframeEvents.RoomStateChanged, payload: state });
        if (state.cameraState) {
            this.computedStyle(state);
        }
        if (state.memberState) {
            this.computedZindex();
            this.updateStyle();
        }
        if (state.sceneState) {
            this.computedIframeDisplay(state, this.attributes);
        }
    }

    private computedStyle(state: DisplayerState): void {
        const cameraState = state.cameraState;
        if (this.iframe) {
            const {width, height, scale, centerX, centerY} = cameraState;
            const transformOriginX = `${(width / 2)}px`;
            const transformOriginY = `${(height / 2)}px`;
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
        if (!state.sceneState.scenePath.startsWith(attributes.displaySceneDir)) {
            IframeBridge.emitter.emit(IframeEvents.HideIframe);
        } else {
            IframeBridge.emitter.emit(IframeEvents.DispayIframe);
        }
    }

    public computedZindex(): void {
        const zIndexString = "z-index: -1;";
        const index = this.cssList.findIndex(css => css === zIndexString);
        if (index !== -1) {
            this.cssList.splice(index, 1);
        }
        if (!this.isClicker() || this.isDisableInput) {
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
            case IframeEvents.SetPage: {
                this.handleSetPage(data);
                break;
            }
            case IframeEvents.GetAttributes: {
                this.handleGetAttributes();
                break;
            }
            case IframeEvents.PageTo: {
                this.handlePageTo(data);
                break
            }
            default: {
                // console.warn(`${data.kind} not allow event.`);
                break;
            }
        }
    }

    private handleSDKCreate(): void {
        this.postMessage({ kind: IframeEvents.Init, payload: {
            attributes: this.attributes,
            roomState: IframeBridge.displayer.state,
            currentPage: this.currentPage,
            observerId: this.displayer.observerId
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
        if (this.canOperation) {
            const nextPageNum = this.currentPage + 1;
            if (nextPageNum > this.totalPage) {
                return;
            }
            (this.displayer as any).setSceneIndex(nextPageNum - 1);
            this.dispatchMagixEvent(IframeEvents.NextPage, {});
        }
    }

    private handlePrevPage(): void {
        if (this.canOperation) {
            const prevPageNum = this.currentPage - 1;
            if (prevPageNum < 0) {
                return;
            }
            (this.displayer as any).setSceneIndex(prevPageNum - 1);
            this.dispatchMagixEvent(IframeEvents.PrevPage, {});
        }
    }

    private handlePageTo(data: any): void {
        if (this.canOperation) {
            const page = data.payload as number;
            if (!Number.isSafeInteger(page) || page <= 0) {
                return;
            }
            const index = page - 1;
            (this.displayer as any).setSceneIndex(index);
            this.dispatchMagixEvent(IframeEvents.PageTo, index);
        }
    }

    private handleRemoveAllMagixEvent(): void {
        this.magixEventMap.forEach((listener, event) => {
            this.displayer.removeMagixEventListener(event, listener);
        });
        this.magixEventMap.clear();
    }

    private handleGetAttributes(): void {
        this.postMessage({
            kind: IframeEvents.GetAttributes,
            payload: this.attributes,
        });
    }

    public postMessage(message: any): void {
        if (this.iframe) {
            this.iframe.contentWindow?.postMessage(message, "*");
        }
    }

    public dispatchMagixEvent(event: string, payload: any): void {
        if (this.canOperation) {
            super.setAttributes({ lastEvent: { name: event, payload } });
            (this.displayer as Room).dispatchMagixEvent(event, payload);
        }
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
        return isPlayer(this.displayer);
    }

    public get inDisplaySceneDir(): boolean {
        return this.displayer.state.sceneState.scenePath.startsWith(this.attributes.displaySceneDir);
    }

    private get canOperation(): boolean {
        if (this.isReplay) {
            return false;
        }
        if (this.readonly) {
            return false;
        }
        return (this.displayer as Room).phase === RoomPhase.Connected;
    }

    private isClicker(): boolean {
        if (this.readonly) {
            return false;
        }
        const currentApplianceName = (this.displayer as Room).state.memberState.currentApplianceName;
        return this.allowAppliances.includes(currentApplianceName);
    }

    private get isDisableInput(): boolean {
        if ("disableDeviceInputs" in this.displayer) {
            return (this.displayer as Room).disableDeviceInputs;
        } else {
            return true;
        }
    }

    private get iframeOrigin (): string | undefined {
        if (this.iframe) {
            const url = new URL(this.iframe.src);
            return url.origin;
        } else {
            return undefined;
        }
    }

    private _destory(): void {
        window.removeEventListener("message", this.messageListener);
        this.magixEventMap.forEach((listener, event) => {
            this.displayer.removeMagixEventListener(event, listener);
        });

        this.displayer.callbacks.off(this.callbackName, this.stateChangeListener);
        this.displayer.callbacks.off("onPhaseChanged", this.onPhaseChangedListener);
        this.magixEventMap.clear();
        if (this.iframe) {
            IframeBridge.emitter.emit(IframeEvents.Destory);
            this.iframe = null;
            IframeBridge.alreadyCreate = false;
        }
    }
}

export * from "./iframeWrapper";
