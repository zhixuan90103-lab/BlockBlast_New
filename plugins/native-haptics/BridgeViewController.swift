import UIKit
import Capacitor

@objc(BridgeViewController)
final class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeHapticsPlugin())
        CAPLog.print("⚡️ NativeHapticsPlugin registered manually")
    }
}
