# IframeBridge

> 本项目主要用于转发白板的事件和属性到 `iframe`, 管理 `iframe` 的插入, 以及对白板的视角变化的跟随

>注意, `iframe` 只有在教具为 `选择工具` 时候才能进行交互

## 安装
```
# npm
npm install netless-iframe-bridge

# yarn
yarn add netless-iframe-bridge
```

## example

``` typescript
import {WhiteWebSdk} from "white-react-sdk"
import {IframeBridge, IframeWrapper} from "netless-iframe-bridge"

const sdk = new WhiteWebSdk({
  // 其他参数
  invisiblePlugins: [IframeBridge],
  wrappedComponents: [IframeWrapper],
})

const room = await sdk.joinRoom()

let bridge;

bridge = room.getInvisiblePlugin(IframeBridge.kind) // bridge 插入一次后续会自动插入，所以需要先 get 防止重复插入

if (!bridge) {
    bridge = await IframeBridge.insert({
        room: room, // room 实例
        url: "example.com", // iframe 的地址
        width: 1280, // 课件的宽, 单位 px
        height: 720, // 课件的高, 单位 px
        displaySceneDir: "/example" // 自定义 h5 课件绑定的 scene 目录，切换到其他目录，课件会自动隐藏，注意，此目录需要用户在白板中自行创建
    })
}
```

## `setIframeSize`
```typescript
bridge.setIframeSize({ width: 1200, height: 700 }) // 修改 iframe 的宽高
```

## `attributes`
`attributes` 是会在所有插件中同步的属性, 类似于白板中的 `globalState` 概念, 但是只是同步在所有的插件中
```typescript
bridge.attributes
```

## `setAttributes`
修改 `attributes`, 并且会触发事件传递 `attributes` 到 `iframe` 中

`readOnly` 模式下不可用
```typescript
bridge.setAttributes({ name: "bridge" })
```

## `on`
监听 `iframe``load` 事件
```typescript
import { DomEvents } from "@netless/iframe-bridge"

bridge.on(DomEvents.IframeLoad, (event) => {
    // code
})
``` 

## `destroy`
销毁插件
```typescript
bridge.destroy()
```

## 在特定 `scene` 中使用 `H5` 课件

1. 插入 `h5` 目录和页面至白板
```typescript
const dir = "/h5" // h5 课件在白板中的目录名称，可以自定义为任意名称，注意不要跟已有目录重复
const scenes = [{name: "第一页"}, { name: "第二页" }] // h5 课件有多少页可以创建多少个, 但并不是严格对应
room.putScenes(dir, scenes)
```

2. 切换至 `h5` 课件目录
```typescript
room.setScenePath("/h5/第一页") // 设置为课件目录的第一页
```

3. 翻页
可以使用 `sdk` 封装的翻页，也可以自己调用白板的翻页
参考: [白板翻页](https://developer.netless.link/docs/javascript/features/js-scenes/#%E7%BF%BB%E9%A1%B5%EF%BC%88%E5%90%8C%E7%9B%AE%E5%BD%95%EF%BC%89)
```typescript
// 白板翻页
room.setSceneIndex(room.state.sceneState.index - 1); // 上一页
room.setSceneIndex(room.state.sceneState.index + 1) // 下一页
```

## 切换课件
```typescript
bridge.setAttributes({ url: "https://xxxx.com" })
```
