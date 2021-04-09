import { IframeEvents } from "../../dist"

let page = 1

const postMessage = (payload) => {
    parent.postMessage(payload, "*");
}

window.addEventListener("load", () => { // 当页面加载完成时发送一个 SetPage 事件设置白板的页数
    postMessage({
        kind: IframeEvents.SetPage,
        payload: 10 // 根据课件的页数自行设置
    });
})

const stateDom = document.getElementById("state");

window.addEventListener("message", (event) => {
    const data = event.data;
    const kind = data.kind;
    if (kind === IframeEvents.RoomStateChanged) { // 获取白板 room 更新的状态
        stateDom.innerText = JSON.stringify(data.payload, null, 2);
    }
    if (kind === IframeEvents.GetAttributes) {
        stateDom.innerText = JSON.stringify(data.payload, null, 2);
    }
    if (kind === IframeEvents.ReciveMagixEvent) { // 接收到自定义事件
        const payload = data.payload;
        if (payload.type === "nextPage") { // 如果是下一页课件的页数状态
            page = page + 1;
        }
    }
})

const button = document.getElementById("getAttributes");
const nextPage = document.getElementById("nextPage");

button.addEventListener("click", () => {
    postMessage({ kind: events.GetAttributes }); // 获取插件的 attributes
})

nextPage.addEventListener("click", () => {
    page = page + 1;
    postMessage({
        kind: IframeEvents.DispatchMagixEvent,
        payload: {
            type: "nextPage"
        }
    })
})