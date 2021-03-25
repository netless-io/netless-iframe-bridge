import * as React from "react";
import { IframeBridge, DomEvents, IframeEvents } from "./index";

type IframeWrapperState = {
    canDisplay: boolean;
};

export class IframeWrapper extends React.Component<{}, IframeWrapperState> {

    public constructor(props: {}) {
        super(props);
        this.state = {
            canDisplay: true,
        };
    }

    public componentDidMount(): void {
        IframeBridge.emitter.emit(DomEvents.WrapperDidMount);
        IframeBridge.emitter.on(IframeEvents.Destory, () => {
            this.setState({ canDisplay: false });
        });
        IframeBridge.emitter.on(IframeEvents.StartCreate, () => {
            this.setState({ canDisplay: true });
        });
    }

    public componentDidUpdate(): void {
        IframeBridge.emitter.emit(IframeEvents.WrapperDidUpdate);
    }

    public render(): React.ReactNode {
        return <React.Fragment>
            {this.props.children}
            {this.state.canDisplay && <iframe id={IframeBridge.kind}></iframe>}
        </React.Fragment>;
    }
}
