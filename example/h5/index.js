const postMessage = (payload) => {
    parent.postMessage(payload, "*");
}

const events = {
    RoomStateChanged: "RoomStateChanged",
    GetAttributes: "GetAttributes",
}

window.addEventListener("load", () => { // 当页面加载完成时发送一个 SetPage 事件设置白板的页数
    postMessage({
        kind: "SetPage",
        payload: 10 // 根据课件的页数自行设置
    });
})

const stateDom = document.getElementById("state");

window.addEventListener("message", (event) => {
    const data = event.data;
    const kind = data.kind;
    if (kind === events.RoomStateChanged) { // 获取白板 room 更新的状态
        stateDom.innerText = JSON.stringify(data.payload, null, 2);
    }
    if (kind === events.GetAttributes) {
        stateDom.innerText = JSON.stringify(data.payload, null, 2);
    }
})

const button = document.getElementById("getAttributes");

button.addEventListener("click", () => {
    postMessage({ kind: events.GetAttributes }); // 获取插件的 attributes 
})