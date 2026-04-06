import AVFoundation

class SoundEngine {
    static let shared = SoundEngine()

    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private let sampleRate: Double = 44100

    private init() {
        setupEngine()
    }

    private func setupEngine() {
        audioEngine = AVAudioEngine()
        playerNode = AVAudioPlayerNode()
        guard let engine = audioEngine, let player = playerNode else { return }
        engine.attach(player)
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        engine.connect(player, to: engine.mainMixerNode, format: format)
        try? engine.start()
    }

    private func playTone(frequency: Double, duration: Double, volume: Float = 0.3, fadeOut: Bool = true) {
        guard let player = playerNode else { return }
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!, frameCapacity: frameCount) else { return }
        buffer.frameLength = frameCount

        let data = buffer.floatChannelData![0]
        for i in 0..<Int(frameCount) {
            let t = Double(i) / sampleRate
            let envelope: Float = fadeOut ? Float(1.0 - t / duration) : 1.0
            data[i] = Float(sin(2.0 * .pi * frequency * t)) * volume * envelope
        }

        player.scheduleBuffer(buffer, completionHandler: nil)
        if !player.isPlaying { player.play() }
    }

    private func playNoise(duration: Double, volume: Float = 0.1) {
        guard let player = playerNode else { return }
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!, frameCapacity: frameCount) else { return }
        buffer.frameLength = frameCount

        let data = buffer.floatChannelData![0]
        for i in 0..<Int(frameCount) {
            let t = Double(i) / sampleRate
            let envelope = Float(1.0 - t / duration)
            data[i] = Float.random(in: -1...1) * volume * envelope
        }

        player.scheduleBuffer(buffer, completionHandler: nil)
        if !player.isPlaying { player.play() }
    }

    // --- Game Sounds ---

    /// Card played — short click/tap sound
    func cardPlay() {
        playTone(frequency: 880, duration: 0.05, volume: 0.2)
    }

    /// Stress received — low thud
    func stressHit() {
        playTone(frequency: 120, duration: 0.15, volume: 0.4)
    }

    /// Chill played — gentle high chime
    func chillSound() {
        playTone(frequency: 1200, duration: 0.2, volume: 0.15)
        Task {
            try? await Task.sleep(for: .milliseconds(100))
            playTone(frequency: 1500, duration: 0.2, volume: 0.12)
        }
    }

    /// Zen played — ascending chord (bliss)
    func zenSound() {
        playTone(frequency: 523, duration: 0.6, volume: 0.15) // C5
        Task {
            try? await Task.sleep(for: .milliseconds(150))
            playTone(frequency: 659, duration: 0.5, volume: 0.15) // E5
            try? await Task.sleep(for: .milliseconds(150))
            playTone(frequency: 784, duration: 0.5, volume: 0.15) // G5
            try? await Task.sleep(for: .milliseconds(150))
            playTone(frequency: 1047, duration: 0.8, volume: 0.12) // C6
        }
    }

    /// Meltdown — descending alarm
    func meltdownSound() {
        Task {
            for i in 0..<4 {
                let freq = 800.0 - Double(i) * 150.0
                playTone(frequency: freq, duration: 0.12, volume: 0.4)
                try? await Task.sleep(for: .milliseconds(140))
            }
            playNoise(duration: 0.3, volume: 0.15)
        }
    }

    /// Tantrum — sharp impact
    func tantrumSound() {
        playTone(frequency: 200, duration: 0.08, volume: 0.5)
        playNoise(duration: 0.15, volume: 0.2)
    }

    /// Turn start — subtle ping
    func turnPing() {
        playTone(frequency: 1000, duration: 0.08, volume: 0.1)
    }

    /// Round/game win — victory fanfare
    func victorySound() {
        Task {
            playTone(frequency: 523, duration: 0.15, volume: 0.2) // C
            try? await Task.sleep(for: .milliseconds(120))
            playTone(frequency: 659, duration: 0.15, volume: 0.2) // E
            try? await Task.sleep(for: .milliseconds(120))
            playTone(frequency: 784, duration: 0.15, volume: 0.2) // G
            try? await Task.sleep(for: .milliseconds(120))
            playTone(frequency: 1047, duration: 0.4, volume: 0.25) // C (octave up)
        }
    }

    /// Heartbeat for high stress — call repeatedly
    func heartbeat() {
        playTone(frequency: 60, duration: 0.1, volume: 0.3)
        Task {
            try? await Task.sleep(for: .milliseconds(120))
            playTone(frequency: 55, duration: 0.08, volume: 0.2)
        }
    }

    /// Swap — swoosh
    func swapSound() {
        Task {
            for i in 0..<10 {
                let freq = 300.0 + Double(i) * 80.0
                playTone(frequency: freq, duration: 0.02, volume: 0.15)
                try? await Task.sleep(for: .milliseconds(20))
            }
        }
    }

    /// Shield activated
    func shieldSound() {
        playTone(frequency: 440, duration: 0.1, volume: 0.15)
        Task {
            try? await Task.sleep(for: .milliseconds(80))
            playTone(frequency: 660, duration: 0.15, volume: 0.12)
        }
    }
}
