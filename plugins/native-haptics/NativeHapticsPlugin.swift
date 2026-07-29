import Foundation
import Capacitor
import CoreHaptics
import UIKit

@objc(NativeHapticsPlugin)
public class NativeHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeHapticsPlugin"
    public let jsName = "NativeHaptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playTransient", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startContinuous", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateContinuous", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopContinuous", returnType: CAPPluginReturnPromise)
    ]

    private var engine: CHHapticEngine?
    private var engineStarted = false
    private var suctionPlayer: CHHapticAdvancedPatternPlayer?
    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactSoft = UIImpactFeedbackGenerator(style: .soft)
    private let impactRigid = UIImpactFeedbackGenerator(style: .rigid)
    private let impactHeavy = UIImpactFeedbackGenerator(style: .heavy)

    private var supportsCoreHaptics: Bool {
        CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    @objc public override func load() {
        DispatchQueue.main.async {
            self.impactLight.prepare()
            self.impactSoft.prepare()
            self.impactRigid.prepare()
            self.impactHeavy.prepare()
        }
    }

    @objc func prepare(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                try self.ensureEngineStarted()
                self.prepareFallbackGenerators()
                call.resolve(["supported": self.supportsCoreHaptics])
            } catch {
                self.prepareFallbackGenerators()
                call.resolve([
                    "supported": self.supportsCoreHaptics,
                    "fallback": true
                ])
            }
        }
    }

    @objc func playTransient(_ call: CAPPluginCall) {
        let intensity = clamp01(call.getFloat("intensity", 0.25))
        let sharpness = clamp01(call.getFloat("sharpness", 0.4))

        DispatchQueue.main.async {
            self.playTransient(intensity: intensity, sharpness: sharpness)
            call.resolve()
        }
    }

    @objc func startContinuous(_ call: CAPPluginCall) {
        let intensity = clamp01(call.getFloat("intensity", 0.08))
        let sharpness = clamp01(call.getFloat("sharpness", 0.18))

        DispatchQueue.main.async {
            self.startContinuous(intensity: intensity, sharpness: sharpness)
            call.resolve()
        }
    }

    @objc func updateContinuous(_ call: CAPPluginCall) {
        let intensity = clamp01(call.getFloat("intensity", 0.12))
        let sharpness = clamp01(call.getFloat("sharpness", 0.18))

        DispatchQueue.main.async {
            self.updateContinuous(intensity: intensity, sharpness: sharpness)
            call.resolve()
        }
    }

    @objc func stopContinuous(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopContinuous()
            call.resolve()
        }
    }

    private func clamp01(_ value: Float) -> Float {
        max(0, min(1, value))
    }

    private func prepareFallbackGenerators() {
        impactLight.prepare()
        impactSoft.prepare()
        impactRigid.prepare()
        impactHeavy.prepare()
    }

    // 强度/锐度：仅 clamp 到 [0,1]，不做 boost / 多事件合成；JS 填多少 CH 就用多少。

    private func ensureEngineStarted() throws {
        guard supportsCoreHaptics else { return }
        if engine == nil {
            let nextEngine = try CHHapticEngine()
            nextEngine.isAutoShutdownEnabled = false
            nextEngine.stoppedHandler = { [weak self] _ in
                self?.engineStarted = false
                self?.suctionPlayer = nil
            }
            nextEngine.resetHandler = { [weak self] in
                self?.engine = nil
                self?.engineStarted = false
                self?.suctionPlayer = nil
            }
            engine = nextEngine
            engineStarted = false
        }

        guard let engine else { return }
        if !engineStarted {
            try engine.start()
            engineStarted = true
        }
    }

    private func playTransient(intensity: Float, sharpness: Float) {
        let i = clamp01(intensity)
        let s = clamp01(sharpness)
        if supportsCoreHaptics {
            do {
                try ensureEngineStarted()
                if let engine {
                    // 单次瞬态，参数直通（仅 clamp01）
                    let event = CHHapticEvent(
                        eventType: .hapticTransient,
                        parameters: [
                            CHHapticEventParameter(parameterID: .hapticIntensity, value: i),
                            CHHapticEventParameter(parameterID: .hapticSharpness, value: s)
                        ],
                        relativeTime: 0
                    )
                    let pattern = try CHHapticPattern(events: [event], parameters: [])
                    let player = try engine.makePlayer(with: pattern)
                    try player.start(atTime: CHHapticTimeImmediate)
                    return
                }
            } catch {
                // Fall through to UIKit fallback.
            }
        }

        playTransientFallback(intensity: i)
    }

    private func startContinuous(intensity: Float, sharpness: Float) {
        let i = clamp01(intensity)
        let s = clamp01(sharpness)
        guard supportsCoreHaptics else { return }
        do {
            try ensureEngineStarted()
            if suctionPlayer == nil, let engine {
                let event = CHHapticEvent(
                    eventType: .hapticContinuous,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: i),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: s)
                    ],
                    relativeTime: 0,
                    duration: 30.0
                )
                let pattern = try CHHapticPattern(events: [event], parameters: [])
                suctionPlayer = try engine.makeAdvancedPlayer(with: pattern)
            }
            try suctionPlayer?.start(atTime: CHHapticTimeImmediate)
            try suctionPlayer?.sendParameters([
                CHHapticDynamicParameter(parameterID: .hapticIntensityControl, value: i, relativeTime: 0),
                CHHapticDynamicParameter(parameterID: .hapticSharpnessControl, value: s, relativeTime: 0)
            ], atTime: CHHapticTimeImmediate)
        } catch {
            suctionPlayer = nil
        }
    }

    private func updateContinuous(intensity: Float, sharpness: Float) {
        let i = clamp01(intensity)
        let s = clamp01(sharpness)
        guard supportsCoreHaptics else { return }
        do {
            try ensureEngineStarted()
            if suctionPlayer == nil {
                startContinuous(intensity: intensity, sharpness: sharpness)
                return
            }
            try suctionPlayer?.sendParameters([
                CHHapticDynamicParameter(parameterID: .hapticIntensityControl, value: i, relativeTime: 0),
                CHHapticDynamicParameter(parameterID: .hapticSharpnessControl, value: s, relativeTime: 0)
            ], atTime: CHHapticTimeImmediate)
        } catch {
            suctionPlayer = nil
        }
    }

    private func stopContinuous() {
        if supportsCoreHaptics {
            do {
                try suctionPlayer?.stop(atTime: CHHapticTimeImmediate)
            } catch {
                // Ignore stop errors and clear player anyway.
            }
        }
        suctionPlayer = nil
    }

    private func playTransientFallback(intensity: Float) {
        // 无 Core Haptics 时：UIKit 强度直通 [0,1]，不抬底
        let i = CGFloat(clamp01(intensity))
        if intensity >= 0.7 {
            impactHeavy.impactOccurred(intensity: i)
            impactHeavy.prepare()
            return
        }
        if intensity >= 0.42 {
            impactRigid.impactOccurred(intensity: i)
            impactRigid.prepare()
            return
        }
        impactSoft.impactOccurred(intensity: max(0.01, i))
        impactSoft.prepare()
    }
}
