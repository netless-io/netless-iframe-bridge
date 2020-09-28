# IframeBridge

> 本项目主要用于转发白板的事件和属性到 `iframe`, 管理 `iframe` 的插入, 以及对白板的视角变化的跟随

>注意, `iframe` 只有在教具为 `选择工具` 时候才能进行交互

## example

``` typescript
import {WhiteWebSdk} from "white-react-sdk"
import {IframeBridge, IframeWrapper} from "@netless/iframe-bridge"

const sdk = new WhiteWebSdk({
  // 其他参数
  invisiblePlugins: [IframeBridge],
  wrappedComponents: [IframeWrapper],
})

const room = await sdk.joinRoom()

const bridge = await IframeBridge.setup({
  room: room, // room 实例
  url: "example.com", // iframe 的地址
  width: 1280, // 课件的宽, 单位 px
  height: 720, // 课件的高, 单位 px
  readOnly: false, // readOnly 为 true 的时候插件只能接受事件，不能发送事件,
  isReplay: false, // 回放房间传入此参数
})
```
## `setReadOnly`
同步插入的 `iframe` 的 `readOnly` 默认为 `true`, 有互动需求的请设置为 `false`
```typescript
bridge.setReadOnly(false)
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