import {InvisiblePlugin, Event, RoomState, Room} from "white-web-sdk";

export type IframeBridgeAttributes = {
    url: string;
    width: number;
    height: number;
    totalPage: number;
};

export type IframeWidthHeigth = {
    width: number;
    height: number;
};

export type SetupPayload = {
    room: Room;
    url: string;
    totalPage: number;
    width: number;
    height: number;
    sceneDir?: string;
    onLoad?: (event: globalThis.Event) => void;
};

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
}

export class IframeBridge extends InvisiblePlugin<IframeBridgeAttributes> {

    public static readonly kind: string = "IframeBridge";

    public static room: Room;
    public iframe: HTMLIFrameElement | null = null;
    private magixEventMap: Map<string, (event: Event) => void> = new Map();

    public onAttributesUpdate(attributes: IframeBridgeAttributes): void {
        this.postMessage({ kind: IframeEvents.AttributesUpdate, payload: attributes });
    }

    public onDestroy(): void {
        window.removeEventListener("message", this.messageListener);
        this.magixEventMap.forEach((listener, event) => {
            IframeBridge.room.removeMagixEventListener(event, listener);
        });
        this.magixEventMap.clear();
        if (this.iframe) {
            this.iframe.parentNode?.removeChild(this.iframe);
        }
    }

    public static async setup(payload: SetupPayload): Promise<IframeBridge> {
        let instance = (payload.room as any).getInvisiblePlugin(IframeBridge.kind);
        if (!instance) {
            const initAttributes: IframeBridgeAttributes = {
                url: payload.url,
                width: payload.width,
                height: payload.height,
                totalPage: payload.totalPage,
            };
            instance = await payload.room.createInvisiblePlugin(IframeBridge, initAttributes);
        }
        IframeBridge.room = payload.room;
        instance.listenIframe(payload);
        instance.fllowCamera(payload.room);
        instance.createScene(payload);
        return instance;
    }

    public setIframeWidthHeigth(params: IframeWidthHeigth): void {
        if (this.iframe) {
            this.iframe.width = `${params.width}px`;
            this.iframe.height = `${params.height}px`;
            this.setAttributes({ width: params.width, height: params.height });
        }
    }

    private createScene(payload: SetupPayload): void {
        const sceneDir = payload.sceneDir || "/h5";
        const scenes = new Array(payload.totalPage).fill(0).map((_, index) => {
            return { name: `${index + 1}` };
        });
        payload.room.putScenes(sceneDir, scenes);
        payload.room.setScenePath(sceneDir);
        payload.room.setSceneIndex(0);
        this.setAttributes({
            totalPage: payload.totalPage,
            width: payload.width,
            height: payload.height,
        });
    }

    private listenIframe(payload: SetupPayload): void {
        const iframe = document.getElementById(IframeBridge.kind) as HTMLIFrameElement;
        if (iframe) {
            iframe.src = payload.url;
            iframe.width = `${payload.width}px`;
            iframe.height = `${payload.height}px`;
            this.iframe = iframe;
            window.addEventListener("message", this.messageListener.bind(this));
            iframe.addEventListener("load", (ev: globalThis.Event) => {
                this.postMessage({ kind: IframeEvents.Init, payload: {
                    attributes: this.attributes,
                    roomState: payload.room.state,
                } });
                if (payload.onLoad) {
                    payload.onLoad(ev);
                }
            });
        }
    }

    private fllowCamera(room: Room): void {
        this.computedCssText(room.state);
        room.callbacks.on("onRoomStateChanged", (state: RoomState) => {
            this.postMessage({ kind: IframeEvents.RoomStateChanged, payload: state });
            if (state.cameraState || state.memberState) {
                this.computedCssText(room.state);
            }
        });
    }

    private computedCssText(state: RoomState): void {
        const cameraState = state.cameraState;
        if (this.iframe) {
            const { width, height } = this.getIframeWidthHeight(this.iframe);
            const position = "position: absolute;";
            const borderWidth = "border-width: 0px;";
            const transformOriginX = `${(cameraState.width / 2)}px`;
            const transformOriginY = `${(cameraState.height / 2)}px`;
            const left = `left: ${(cameraState.width - width) / 2}px;`;
            const top = `top: ${(cameraState.height - height) / 2}px;`;
            const transformOrigin = `transform-origin: ${transformOriginX} ${transformOriginY};`;
            const x =  - ((cameraState.centerX) * cameraState.scale);
            const y = - ((cameraState.centerY) * cameraState.scale);
            const transform = `transform: translate(${x}px,${y}px) scale(${cameraState.scale}, ${cameraState.scale});`;
            const cssList = [position, borderWidth, top, left, transformOrigin, transform];
            const isSelector = this.isSelector(state);
            if (!isSelector) {
                cssList.push("z-index: -1");
            }
            this.iframe.style.cssText = cssList.join(" ");
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
            case IframeEvents.RegisterMagixEvent: {
                this.handleRemoveMagixEvent(data);
                break;
            }
            case IframeEvents.DispatchMagixEvent: {
                this.handleDispatchMagixEvent(data);
                break;
            }
            case IframeEvents.RegisterMagixEvent: {
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
        }
    }

    private handleDispatchMagixEvent(data: any): void {
        const eventPayload = data.payload;
        let payload = eventPayload.payload;
        if ((typeof payload) !== "object") {
            payload = JSON.parse(payload);
        }
        this.dispatchMagixEvent(eventPayload.event, payload);
    }

    private handleSetAttributes(data: any): void {
        this.setAttributes(data.payload);
    }

    private handleRegisterMagixEvent(data: any): void {
        const eventName = data.payload as string;
        const listener = (event: Event) => {
            if (event.authorId === IframeBridge.room.observerId) {
                return;
            }
            this.postMessage({ kind: IframeEvents.ReciveMagixEvent, payload: event });
        };
        this.magixEventMap.set(eventName, listener);
        IframeBridge.room.addMagixEventListener(eventName, listener);
    }

    private handleRemoveMagixEvent(data: any): void {
        const eventName = data.payload as string;
        const listener = this.magixEventMap.get(eventName);
        IframeBridge.room.removeMagixEventListener(eventName, listener);
    }

    private handleNextPage(): void {
        const nextPageNum = this.currentPage + 1;
        if (nextPageNum > this.attributes.totalPage) {
            return;
        }
        IframeBridge.room.setSceneIndex(nextPageNum - 1);
        this.dispatchMagixEvent(IframeEvents.NextPage, {});
    }

    private handlePrevPage(): void {
        const prevPageNum = this.currentPage - 1;
        if (prevPageNum < 0) {
            return;
        }
        IframeBridge.room.setSceneIndex(prevPageNum - 1);
        this.dispatchMagixEvent(IframeEvents.PrevPage, {});
    }

    private handleRemoveAllMagixEvent(): void {
        this.magixEventMap.forEach((listener, event) => {
            IframeBridge.room.removeMagixEventListener(event, listener);
        });
        this.magixEventMap.clear();
    }

    private postMessage(message: any): void {
        if (this.iframe) {
            this.iframe.contentWindow?.postMessage(message, "*");
        }
    }

    private dispatchMagixEvent(event: string, payload: object): void {
        if (this.isFollower) {
            return;
        }
        IframeBridge.room.dispatchMagixEvent(event, payload);
    }


    private get isFollower (): boolean {
        return IframeBridge.room.state.broadcastState.mode === "follower";
    }

    private get currentIndex(): number {
        return IframeBridge.room.state.sceneState.index;
    }

    private get currentPage(): number {
        return this.currentIndex + 1;
    }

    private isSelector(state: RoomState): boolean {
        return state.memberState.currentApplianceName === "selector";
    }

    private getIframeWidthHeight(iframe: HTMLIFrameElement): IframeWidthHeigth {
        const width = iframe.getAttribute("width") || "0";
        const height = iframe.getAttribute("height") || "0";
        return { width: parseInt(width), height: parseInt(height) };
    }

    private get iframeOrigin (): string {
        const url = new URL(this.iframe!.src);
        return url.origin;
    }
}

export * from "./iframeWrapper";
