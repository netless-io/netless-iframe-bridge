# IframeBridge

> This project is mainly used to bridge whiteboard events and properties to `iframe`, manage the insertion of `iframe`, and follow the view changes of the whiteboard

> Note that the `iframe` can only be interacted with when the tool is the `selection tool`.

## Installation
```
# npm
npm install @netless/iframe-bridge

# yarn
yarn add @netless/iframe-bridge
```

## example

``` typescript
import {WhiteWebSdk} from "white-web-sdk"
import {IframeBridge, IframeWrapper} from "@netless/iframe-bridge"

const sdk = new WhiteWebSdk({
  // other parameters
  invisiblePlugins: [IframeBridge],
  wrappedComponents: [IframeWrapper],
})

const room = await sdk.joinRoom()

let bridge;

bridge = room.getInvisiblePlugin(IframeBridge.kind) // bridge inserted once will be inserted automatically, so you need to get first to prevent duplicate insertion

if (!bridge) {
    bridge = await IframeBridge.insert({
        room: room, // room instance
        url: "example.com", // address of the iframe
        width: 1280, // the width of the lesson, in px
        height: 720, // height of the lesson, in px
        displaySceneDir: "/example", // Customize the scene directory where the h5 courseware is bound, if you switch to another directory, the courseware will be hidden automatically.
        useSelector: false, // This option is optional, the default is false, on will allow selector teaching aids to operate the courseware
    })
}
```

## `attributes`
``attributes`` are attributes that will be synchronized across all plugins, similar to the ``globalState`` concept in the whiteboard, but only across all plugins
```typescript
bridge.attributes
```

## ``setAttributes``
modifies `attributes`, and will trigger an event to pass `attributes` to the `iframe`

Not available in `readOnly` mode
```typescript
bridge.setAttributes({ name: "bridge" })
```

## `setIframeSize`
```typescript
bridge.setIframeSize({ width: 1200, height: 700 }) // modify the width and height of the iframe
```

## Listening to `bridge` events
Listening to the `iframe` `load` event
```typescript
import { DomEvents } from "@netless/iframe-bridge"

IframeBridge.emitter.on(DomEvents.IframeLoad, (event) => {
    // code
})
``` 

## ``destroy``
Destroy the plugin
```typescript
bridge.destroy()
```

## Use `H5` courseware in a specific `scene`

1. Insert custom directories and pages to the whiteboard
```typescript
const dir = "/example" // the name of the directory of the h5 courseware in the whiteboard, can be customized to any name, be careful not to duplicate the existing directory
const scenes = [{name: "first page" }, { name: "second page" }] // how many pages of the h5 courseware can be created, but they don't strictly correspond
room.putScenes(dir, scenes)
```` 2.

2. switch to custom courseware directory
```typescript
room.setScenePath("/example/first page") // set it to the first page of the courseware directory
```

3. Turning pages
You can use `sdk` wrapped page flip, or you can call the whiteboard page flip yourself
Reference: [Whiteboard Page Flip](https://developer.netless.link/docs/javascript/features/js-scenes/#%E7%BF%BB%E9%A1%B5%EF%BC%88%E5%90%8C%E7%9B%AE%E5%BD% 95%EF%BC%89)
```typescript
// Whiteboard page flip
room.setSceneIndex(room.state.sceneState.index - 1); // previous page
room.setSceneIndex(room.state.sceneState.index + 1) // next page
```

## Toggle class
```typescript
bridge.setAttributes({ url: "https://xxxx.com" })
```

### iframe spreads the screen
```typescript
bridge.scaleIframeToFit()
```

### Set the page count directly in the `iframe
``IframeBridge`` will listen for events from the ``iframe`` and handle them

and only accepts data in this format
```typescript
type
    kind: `event name`,
    payload: data
}
```

To set the whiteboard to the page directly in the `iframe` you need to `postMessage` to `IframeBridge`
```typescript
parent.postMessage({
    kind: "SetPage",
    payload: 10 // set the number of pages according to the h5 courseware
})
```

### Plugin events

| Event Name | Explanation |
| ------------------- | ------------------------------------------------------------ |
| Init | Sends the `init` event when the `iframe` `load` event completes |
| AttributesUpdate | Triggered when the `attributes` of the plugin is updated |
| SetAttributes | listens for a `postMessage` message from the `iframe` and sets the `attributes` from the `SetAttributes` event |
| RegisterMagixEvent | Register custom events for the whiteboard |
| RemoveMagixEvent | Remove the whiteboard's custom events |
| RemoveAllMagixEvent | Remove all custom events from the whiteboard |
| DispatchMagixEvent | Send a custom event to the whiteboard |
| ReciveMagixEvent | Receive custom events |
| OnCreate | Sends an event when the plugin is created |
| SetPage | Set the number of pages in the whiteboard
| GetAttributes | Receiving this event sends an event with the same name to the `iframe` with the current `attributes` |



### Dom events

| Events | Explanation |
| --------------- | -------------------------------------------- |
| WrapperDidMount | Triggered when the `wrapper` component of an `iframe` `didMount` |
| IframeLoad | Triggered by the `load` event of `iframe` |
