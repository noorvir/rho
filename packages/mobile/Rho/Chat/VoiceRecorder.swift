import AVFoundation
import Foundation
import Observation

struct PendingAudio: Equatable {
    let url: URL
    let duration: TimeInterval
}

/// Records voice messages to temporary .m4a files and publishes elapsed time
/// plus recent meter levels for waveform rendering. Drives the composer's
/// recording bar: start → (pause/resume) → finish or cancel.
@Observable
final class VoiceRecorder {
    enum State {
        case idle
        case recording
        case paused
    }

    private(set) var state: State = .idle
    private(set) var elapsed: TimeInterval = 0
    private(set) var levels: [Float] = []

    private var recorder: AVAudioRecorder?
    private var timer: Timer?

    func start() {
        AVAudioApplication.requestRecordPermission { granted in
            DispatchQueue.main.async {
                if granted {
                    self.beginRecording()
                }
            }
        }
    }

    func togglePause() {
        guard let recorder else { return }

        if state == .recording {
            recorder.pause()
            state = .paused
        } else if state == .paused {
            recorder.record()
            state = .recording
        }
    }

    func cancel() {
        guard let recorder else { return }
        recorder.stop()
        recorder.deleteRecording()
        reset()
    }

    func finish() -> PendingAudio? {
        guard let recorder else { return nil }

        let audio = PendingAudio(url: recorder.url, duration: elapsed)
        recorder.stop()
        reset()

        guard audio.duration >= 1 else {
            try? FileManager.default.removeItem(at: audio.url)
            return nil
        }
        return audio
    }

    private func beginRecording() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .default)
        try? session.setActive(true)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("voice-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]

        guard let recorder = try? AVAudioRecorder(url: url, settings: settings) else { return }
        recorder.isMeteringEnabled = true
        recorder.record()

        self.recorder = recorder
        state = .recording
        elapsed = 0
        levels = []

        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    private func tick() {
        guard let recorder, state == .recording else { return }

        recorder.updateMeters()
        elapsed = recorder.currentTime

        let power = recorder.averagePower(forChannel: 0)
        let level = max(0, min(1, (power + 50) / 50))
        levels.append(level)
        if levels.count > 48 {
            levels.removeFirst(levels.count - 48)
        }
    }

    private func reset() {
        timer?.invalidate()
        timer = nil
        recorder = nil
        state = .idle
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
