import * as React from "react";
import { IframeBridge, DomEvents, IframeEvents } from "./index";

type IframeWrapperState = {
    canDisplay: boolean;
    className: string | undefined;
};

export class IframeWrapper extends React.Component<{}, IframeWrapperState> {
    private static readonly hiddenClass: string = "netless-iframe-brdige-hidden";
    private styleDom: HTMLStyleElement | null = null;

    public constructor(props: {}) {
        super(props);
        this.state = {
            canDisplay: true,
            className: IframeWrapper.hiddenClass,
        };
        this.injectCss();
        IframeBridge.emitter.on(IframeEvents.Destory, () => {
            this.setState({ canDisplay: false });
        });
        IframeBridge.emitter.on(IframeEvents.StartCreate, () => {
            this.setState({ canDisplay: true });
        });
        IframeBridge.emitter.on(IframeEvents.DispayIframe, () => {
            this.setState({ className: undefined });
        });
        IframeBridge.emitter.on(IframeEvents.HideIframe, () => {
            this.setState({ className: IframeWrapper.hiddenClass });
        });
    }

    public componentDidMount(): void {
        IframeBridge.emitter.emit(DomEvents.WrapperDidMount);
    }

    public componentWillUnmount(): void {
        if (this.styleDom) {
            this.styleDom.parentNode?.removeChild(this.styleDom);
        }
    }

    public componentDidUpdate(): void {
        IframeBridge.emitter.emit(IframeEvents.WrapperDidUpdate);
    }

    private injectCss(): void {
        const styleDom = document.createElement("style");
        const styleStr = `
            .${IframeWrapper.hiddenClass} {
                display: none;
            }
        `;
        this.styleDom = styleDom;
        styleDom.appendChild(document.createTextNode(styleStr));
        document.getElementsByTagName("head")[0].appendChild(styleDom);
    }

    public render(): React.ReactNode {
        return <React.Fragment>
            {this.props.children}
            {this.state.canDisplay && <iframe id={IframeBridge.kind} className={this.state.className}></iframe>}
        </React.Fragment>;
    }
}
