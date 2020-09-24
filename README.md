# IframeBridge

> 本项目主要用于连接白板和 `Iframe`, 也就是 `H5` 课件

### example

``` typescript
import {WhiteWebSdk} from "white-react-sdk"
import {IframeBridge, IframeWrapper} from "iframe-bridge"

const sdk = new WhiteWebSdk({
 	// 其他参数
  invisiblePlugins: [IframeBridge],
  wrappedComponents: [IframeWrapper],
})

const room = await sdk.joinRoom()

IframeBridge.setup({
  room: room, // room 实例
  url: "example.com", // iframe 的地址
  width: 1280, // 课件的宽, 单位是 px
  height: 720, // 课件的高, 单位是 px
  totalPage: 10, // h5 课件的总页数
})


IframeBridge.setIframeWidthHeigth({ width: 1200, height: 700 }) // 修改 iframe 的宽高
```



