import * as React from "react";
import { IframeBridge, WrapperDidMount } from "./index";

export class IframeWrapper extends React.Component {
    public componentDidMount(): void {
        IframeBridge.emitter.emit(WrapperDidMount);
    }

    public render(): React.ReactNode {
        return <React.Fragment>
            {this.props.children}
            <iframe id={IframeBridge.kind} />
        </React.Fragment>;
    }
}
