# Current Work: iOS chat underlay screenshot

## Goals

Add an iOS chat-overlay action that captures the Rho content visible behind the chat overlay.

The screenshot should include the app-owned content layer below chat, including native UI chrome such as headers, search controls, bottom navigation, and any embedded web/app content. The chat overlay itself should not appear in the captured image.

The captured image should be usable by Rho immediately, for example as an in-chat attachment or visual context for an agent. Saving to Photos or sharing outside Rho is optional and should be a separate user action.

## Non-goals

- Do not capture other apps, system UI, or anything outside Rho's own view hierarchy.
- Do not rely on iOS screen-recording or ReplayKit permissions for this path.
- Do not include the chat overlay in the captured image.
- Do not redesign the chat overlay or the app shell as part of the first implementation.
- Do not add Photos permission unless the user explicitly saves or exports the image.

## Current Direction

Keep the main app content and the chat overlay as separate sibling layers:

```text
Root
├─ Capturable content root
│  ├─ native app chrome
│  ├─ native controls
│  ├─ embedded app/web content
│  └─ bottom navigation
└─ Chat overlay
```

The chat screenshot button should ask a small native capture boundary to render the capturable content root, not the whole window. That makes the captured image reflect what is underneath the overlay while excluding the overlay itself.

A minimal interface can look like this:

```swift
protocol ContentSnapshotProvider {
  func snapshotVisibleContent(crop: CGRect?) async throws -> UIImage
}
```

The first implementation should use a UIKit-backed capture of the real underlying view tree, because the target contains mixed native and possibly web-backed content. A SwiftUI-only renderer is not enough if the content includes UIKit or `WKWebView` subviews.

Implementation notes:

- Hold or discover a stable `UIView` reference for the capturable content root.
- When the chat button is tapped, convert the requested overlay/target rect into the content root's coordinate space.
- Render the content root with `UIGraphicsImageRenderer` and `drawHierarchy(in:afterScreenUpdates:)` using the device scale.
- If only the area directly under the chat panel is needed, crop the rendered image to that converted rect.
- If `WKWebView` content is blank, stale, or unreliable in the mixed hierarchy render, compose the final image by combining the native root capture with `WKWebView.takeSnapshot(with:)` for the web region.
- Keep the output in memory for chat/agent use. Add persistence only at the boundary that needs it.

The capture should run after layout has settled. If the chat opening animation changes the underlying content, capture either before showing chat or after the app reaches the intended steady state, depending on the desired UX.

## Success Criteria

- [ ] Tapping the chat screenshot action returns an image without the chat overlay.
- [ ] The image includes native UI elements under the overlay, not only the web/app view.
- [ ] The image includes visible embedded web content when present.
- [ ] Cropping matches the intended region, using correct coordinates and image scale.
- [ ] The capture works without Photos, screen-recording, or system screenshot permissions.
- [ ] Failure cases return a clear error instead of silently attaching a blank image.

## Tests / Validation

Manually verify on iOS with a screen that contains both native shell UI and embedded content:

- Open the app to a mixed-content screen.
- Open the chat overlay.
- Tap the screenshot action.
- Inspect the resulting image in-app.
- Confirm the chat overlay is absent.
- Confirm native header/search/bottom-nav elements are present when they fall inside the captured region.
- Confirm embedded web/app content is present and current.
- Repeat with scrolled content and with the keyboard dismissed/open if the screenshot action is available while typing.

Before shipping, validate on a physical device as well as the simulator, because UIKit/WebKit snapshot behavior can differ.

## Progress

- [x] Capture feasibility summarized.
- [ ] Decide whether the button captures the full visible content root or only the rect directly underneath the chat panel.
- [ ] Identify the capturable content root in the mobile app view hierarchy.
- [ ] Prototype native view-tree capture.
- [ ] Add WebKit snapshot composition only if the mixed render does not capture web content reliably.
