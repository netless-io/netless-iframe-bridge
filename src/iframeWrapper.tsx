import * as React from "react";
import { IframeBridge } from "./index";

export const IframeWrapper: React.FunctionComponent = ({ children }) => {
    return (
        <React.Fragment>
            {children}
            <iframe id={IframeBridge.kind} />
        </React.Fragment>
    );
};
