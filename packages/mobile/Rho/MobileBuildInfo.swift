import Foundation

enum MobileBuildInfo {
    #if targetEnvironment(simulator)
    static let chatEnvironment = "Local simulator"
    static let chatBaseURL = configuredChatBaseURL(defaultValue: "http://127.0.0.1:7331")
    #else
    static let chatEnvironment = "Railway production"
    static let chatBaseURL = configuredChatBaseURL(defaultValue: "https://rho-server-production.up.railway.app")
    #endif

    private static func configuredChatBaseURL(defaultValue: String) -> URL {
        let configuredValue = Bundle.main.object(forInfoDictionaryKey: "RHO_CHAT_BASE_URL") as? String
        var value = defaultValue

        if let configuredValue, !configuredValue.isEmpty {
            value = configuredValue
        }

        return URL(string: value)!
    }

    static var version: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
        return "\(version) (\(build))"
    }

    static var bundleIdentifier: String {
        Bundle.main.bundleIdentifier ?? "unknown"
    }
}
