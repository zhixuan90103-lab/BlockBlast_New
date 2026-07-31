import UIKit
import Capacitor
import WebKit

@objc(BridgeViewController)
final class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeHapticsPlugin())
        CAPLog.print("⚡️ NativeHapticsPlugin registered manually")
        hardenWebViewTouches()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // 部分手势在 didLoad 后才挂上，再关一次
        hardenWebViewTouches()
    }

    /// 关掉 WKWebView 双指缩放、双击放大、长按预览等网页默认行为
    private func hardenWebViewTouches() {
        guard let webView = self.webView else { return }

        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false

        let scroll = webView.scrollView
        scroll.isScrollEnabled = false
        scroll.bounces = false
        scroll.bouncesZoom = false
        scroll.alwaysBounceVertical = false
        scroll.alwaysBounceHorizontal = false
        scroll.minimumZoomScale = 1.0
        scroll.maximumZoomScale = 1.0
        scroll.zoomScale = 1.0
        scroll.delaysContentTouches = false
        scroll.canCancelContentTouches = false
        scroll.pinchGestureRecognizer?.isEnabled = false
        scroll.panGestureRecognizer.isEnabled = false

        disableZoomGestures(in: scroll.gestureRecognizers)
        disableZoomGestures(in: webView.gestureRecognizers)
    }

    private func disableZoomGestures(in recognizers: [UIGestureRecognizer]?) {
        guard let recognizers else { return }
        for gr in recognizers {
            if gr is UIPinchGestureRecognizer {
                gr.isEnabled = false
                continue
            }
            if let tap = gr as? UITapGestureRecognizer, tap.numberOfTapsRequired >= 2 {
                gr.isEnabled = false
                continue
            }
            // 长按放大镜 / 选择 / callout
            if gr is UILongPressGestureRecognizer {
                gr.isEnabled = false
                continue
            }
        }
    }
}
