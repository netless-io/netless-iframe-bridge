import {InvisiblePlugin, Event, RoomState, Room} from "white-web-sdk";

export type IframeBridgeAttributes = {
    url: string;
    width: number;
    height: number;
    totalPage: number;
    currentPage: number;
    currentIndex: number;
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
    initAttributes = "initAttributes",
    attributesUpdate = "attributesUpdate",
    setAttributesEvent = "setAttributesEvent",
    registerMagixEvent = "registerMagixEvent",
    removeMagixEvent = "removeMagixEvent",
    removeAllMagixEvent = "removeAllMagixEvent",
    magixEvent = "MagixEvent",
    nextPage = "nextPage",
    prevPage = "prevPage",
}

export class IframeBridge extends InvisiblePlugin<IframeBridgeAttributes> {

    public static readonly kind: string = "IframeBridge";

    public static room: Room;
    public iframe: HTMLIFrameElement | null = null;
    private magixEventMap: Map<string, (event: Event) => void> = new Map();

    public onAttributesUpdate(attributes: IframeBridgeAttributes): void {
        this.postMessage({ kind: IframeEvents.attributesUpdate, payload: attributes });
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
                currentPage: 1,
                currentIndex: 0,
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
            this.updateAttributes();
        }
    }

    private createScene(payload: SetupPayload): void {
        const sceneDir = payload.sceneDir || "/h5";
        const currentPage = 1;
        const scenes = new Array(payload.totalPage).fill(0).map((_, index) => {
            return { name: `${index + 1}` };
        });
        payload.room.putScenes(sceneDir, scenes);
        payload.room.setScenePath(sceneDir);
        payload.room.setSceneIndex(currentPage - 1);
        this.setAttributes({
            totalPage: payload.totalPage,
            currentPage,
            width: payload.width,
            height: payload.height,
        });
        this.updateAttributes();
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
                this.postMessage({ kind: IframeEvents.initAttributes, payload: this.attributes });
                if (payload.onLoad) {
                    payload.onLoad(ev);
                }
            });
        }
    }

    private fllowCamera(room: Room): void {
        this.computedCssText(room.state);
        room.callbacks.on("onRoomStateChanged", (state: RoomState) => {
            this.postMessage({ kind: "onRoomStateChanged", payload: state });
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
            case IframeEvents.setAttributesEvent:
                this.handleSetAttributesEvent(data);
                break;
            case IframeEvents.registerMagixEvent:
                this.handleRegisterMagixEvent(data);
                break;
            case IframeEvents.removeMagixEvent:
               this.handleRemoveMagixEvent(data);
               break;
            case IframeEvents.magixEvent:
                this.handleMagixEvent(data);
                break;
            case IframeEvents.removeAllMagixEvent:
                this.handleRemoveAllMagixEvent();
                break;
            case IframeEvents.nextPage:
                this.handleNextPage();
                break;
            case IframeEvents.prevPage:
                this.handlePrevPage();
                break;
        }
    }

    private handleMagixEvent(data: any): void {
        const eventPayload = data.payload;
        let payload = eventPayload.payload;
        if ((typeof payload) !== "object") {
            payload = JSON.parse(payload);
        }
        this.dispatchMagixEvent(eventPayload.event, payload);
    }

    private handleSetAttributesEvent(data: any): void {
        this.setAttributes(data.payload);
        this.updateAttributes();
    }

    private handleRegisterMagixEvent(data: any): void {
        const eventName = data.payload as string;
        const listener = (event: Event) => {
            if (event.authorId === IframeBridge.room.observerId) {
                return;
            }
            this.postMessage({ kind: IframeEvents.magixEvent, payload: event });
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
        const nextPageNum = this.attributes.currentPage + 1;
        if (nextPageNum > this.attributes.totalPage) {
            return;
        }
        this.setAttributes({ currentPage: nextPageNum });
        this.updateAttributes();
        IframeBridge.room.setSceneIndex(nextPageNum - 1);
        this.dispatchMagixEvent(IframeEvents.nextPage, {});
    }

    private handlePrevPage(): void {
        const prevPageNum = this.attributes.currentPage - 1;
        if (prevPageNum < 0) {
            return;
        }
        this.setAttributes({ currentPage: prevPageNum });
        this.updateAttributes();
        IframeBridge.room.setSceneIndex(prevPageNum - 1);
        this.dispatchMagixEvent(IframeEvents.prevPage, {});
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

    private updateAttributes(): void {
        this.postMessage({ kind: IframeEvents.attributesUpdate, payload: this.attributes });
    }

    private get isFollower (): boolean {
        return IframeBridge.room.state.broadcastState.mode === "follower";
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
