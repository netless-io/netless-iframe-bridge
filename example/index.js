import { WhiteWebSdk } from "white-web-sdk"
import { IframeBridge, IframeWrapper } from "../dist"

const whiteWebSdk = new WhiteWebSdk({
    appIdentifier: "appIdentifier",
    invisiblePlugins: [IframeBridge],
    wrappedComponents: [IframeWrapper]
});

const joinRoomParams = {
    uuid: "uuid",
    roomToken: "roomToken",
};

whiteWebSdk.joinRoom(joinRoomParams).then(function(room) {
    // 加入房间成功，获取 room 对象
    // 并将之前的 <div id="whiteboard"/> 占位符变成白板
    room.bindHtmlElement(document.getElementById("whiteboard"));
    window.room = room
    const bridge = room.getInvisiblePlugin(IframeBridge.kind);
    if (!bridge) {
        IframeBridge.insert({ // 插件插入到白板中
            room,
            width: 1280,
            height: 720,
            url: "http://localhost:5000", // iframe url
            displaySceneDir: "/example"
        })
    }
}).catch(function(err) {
    // 加入房间失败
    console.error(err);
});

