import Foundation

enum MobileBuildInfo {
    #if targetEnvironment(simulator)
    static let chatEnvironment = "Local simulator"
    static let chatBaseURL = URL(string: "http://127.0.0.1:7331")!
    #else
    static let chatEnvironment = "Railway production"
    static let chatBaseURL = URL(string: "https://rho-server-production.up.railway.app")!
    #endif

    static var version: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
        return "\(version) (\(build))"
    }

    static var bundleIdentifier: String {
        Bundle.main.bundleIdentifier ?? "unknown"
    }
}
