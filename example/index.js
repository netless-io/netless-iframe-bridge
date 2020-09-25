import { WhiteWebSdk } from "white-web-sdk"
import { IframeBridge, IframeWrapper } from "../dist"
import Dotenv from "dotenv"

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
    setup(room) // 加入房间之后传入 room 实例初始化插件
}).catch(function(err) {
    // 加入房间失败
    console.error(err);
});

// 设置插件
const setup = (room) => {
    IframeBridge.setup({
        room,
        width: 1280,
        height: 720,
        url: "http://localhost:1234", // iframe url
        totalPage: 10,
    })
}