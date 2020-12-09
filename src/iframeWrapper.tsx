import * as React from "react";
import { IframeBridge, DomEvents } from "./index";

export class IframeWrapper extends React.Component {
    public componentDidMount(): void {
        IframeBridge.emitter.emit(DomEvents.WrapperDidMount);
    }

    public render(): React.ReactNode {
        return <React.Fragment>
            {this.props.children}
            <iframe id={IframeBridge.kind} />
        </React.Fragment>;
    }
}
