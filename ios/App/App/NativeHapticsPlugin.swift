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

    private func boostTransientIntensity(_ value: Float) -> Float {
        let v = clamp01(value)
        guard v > 0 else { return 0 }
        return clamp01(0.18 + powf(v, 0.72) * 0.82)
    }

    private func boostTransientSharpness(_ value: Float) -> Float {
        let v = clamp01(value)
        guard v > 0 else { return 0 }
        return clamp01(0.08 + powf(v, 0.82) * 0.92)
    }

    private func boostContinuousIntensity(_ value: Float) -> Float {
        let v = clamp01(value)
        guard v > 0 else { return 0 }
        return clamp01(0.10 + powf(v, 0.78) * 0.90)
    }

    private func boostContinuousSharpness(_ value: Float) -> Float {
        let v = clamp01(value)
        guard v > 0 else { return 0 }
        return clamp01(0.05 + powf(v, 0.88) * 0.95)
    }

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
        let boostedIntensity = boostTransientIntensity(intensity)
        let boostedSharpness = boostTransientSharpness(sharpness)
        if supportsCoreHaptics {
            do {
                try ensureEngineStarted()
                if let engine {
                    var events: [CHHapticEvent] = [
                        CHHapticEvent(
                            eventType: .hapticTransient,
                            parameters: [
                                CHHapticEventParameter(parameterID: .hapticIntensity, value: boostedIntensity),
                                CHHapticEventParameter(parameterID: .hapticSharpness, value: boostedSharpness)
                            ],
                            relativeTime: 0
                        ),
                        CHHapticEvent(
                            eventType: .hapticTransient,
                            parameters: [
                                CHHapticEventParameter(parameterID: .hapticIntensity, value: clamp01(boostedIntensity * 0.72)),
                                CHHapticEventParameter(parameterID: .hapticSharpness, value: clamp01(boostedSharpness * 0.92))
                            ],
                            relativeTime: 0.03
                        )
                    ]
                    if boostedIntensity > 0.35 {
                        events.append(
                            CHHapticEvent(
                                eventType: .hapticContinuous,
                                parameters: [
                                    CHHapticEventParameter(parameterID: .hapticIntensity, value: clamp01(boostedIntensity * 0.28)),
                                    CHHapticEventParameter(parameterID: .hapticSharpness, value: clamp01(boostedSharpness * 0.65))
                                ],
                                relativeTime: 0,
                                duration: 0.045
                            )
                        )
                    }
                    let pattern = try CHHapticPattern(events: events, parameters: [])
                    let player = try engine.makePlayer(with: pattern)
                    try player.start(atTime: CHHapticTimeImmediate)
                    return
                }
            } catch {
                // Fall through to UIKit fallback.
            }
        }

        playTransientFallback(intensity: boostedIntensity)
    }

    private func startContinuous(intensity: Float, sharpness: Float) {
        let boostedIntensity = boostContinuousIntensity(intensity)
        let boostedSharpness = boostContinuousSharpness(sharpness)
        guard supportsCoreHaptics else { return }
        do {
            try ensureEngineStarted()
            if suctionPlayer == nil, let engine {
                let event = CHHapticEvent(
                    eventType: .hapticContinuous,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: boostedIntensity),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: boostedSharpness)
                    ],
                    relativeTime: 0,
                    duration: 30.0
                )
                let pattern = try CHHapticPattern(events: [event], parameters: [])
                suctionPlayer = try engine.makeAdvancedPlayer(with: pattern)
            }
            try suctionPlayer?.start(atTime: CHHapticTimeImmediate)
            try suctionPlayer?.sendParameters([
                CHHapticDynamicParameter(parameterID: .hapticIntensityControl, value: boostedIntensity, relativeTime: 0),
                CHHapticDynamicParameter(parameterID: .hapticSharpnessControl, value: boostedSharpness, relativeTime: 0)
            ], atTime: CHHapticTimeImmediate)
        } catch {
            suctionPlayer = nil
        }
    }

    private func updateContinuous(intensity: Float, sharpness: Float) {
        let boostedIntensity = boostContinuousIntensity(intensity)
        let boostedSharpness = boostContinuousSharpness(sharpness)
        guard supportsCoreHaptics else { return }
        do {
            try ensureEngineStarted()
            if suctionPlayer == nil {
                startContinuous(intensity: intensity, sharpness: sharpness)
                return
            }
            try suctionPlayer?.sendParameters([
                CHHapticDynamicParameter(parameterID: .hapticIntensityControl, value: boostedIntensity, relativeTime: 0),
                CHHapticDynamicParameter(parameterID: .hapticSharpnessControl, value: boostedSharpness, relativeTime: 0)
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
        if intensity >= 0.7 {
            impactHeavy.impactOccurred(intensity: CGFloat(max(0.85, intensity)))
            impactHeavy.prepare()
            return
        }
        if intensity >= 0.42 {
            impactRigid.impactOccurred(intensity: CGFloat(max(0.65, intensity)))
            impactRigid.prepare()
            return
        }
        impactSoft.impactOccurred(intensity: CGFloat(max(0.2, intensity)))
        impactSoft.prepare()
    }
}
