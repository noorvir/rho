import CoreLocation
import MapKit
import SwiftUI

/// Map sheet with a "Send Current Location" action. Requests when-in-use
/// permission on appear and calls `onSendCurrentLocation` with the device's
/// current coordinate, then dismisses.
struct LocationPickerSheet: View {
    let onSendCurrentLocation: (CLLocationCoordinate2D) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var locator = CurrentLocator()
    @State private var position: MapCameraPosition = .userLocation(fallback: .automatic)

    var body: some View {
        VStack(spacing: 0) {
            Map(position: $position) {
                UserAnnotation()
            }

            Button {
                guard let coordinate = locator.coordinate else { return }
                onSendCurrentLocation(coordinate)
                dismiss()
            } label: {
                HStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 44, height: 44)

                        Image(systemName: "location.fill")
                            .font(.system(size: 19, weight: .medium))
                            .foregroundStyle(.white)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Send Current Location")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundStyle(locator.coordinate == nil ? .secondary : .primary)

                        Text(subtitle)
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                    }

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
            .disabled(locator.coordinate == nil)
            .background(Color.white)
        }
        .onAppear {
            locator.start()
        }
    }

    private var subtitle: String {
        guard let accuracy = locator.accuracy else {
            return "Locating…"
        }
        return "Accurate to \(max(1, Int(accuracy))) m"
    }
}

@Observable
private final class CurrentLocator: NSObject, CLLocationManagerDelegate {
    var coordinate: CLLocationCoordinate2D?
    var accuracy: CLLocationAccuracy?

    private let manager = CLLocationManager()

    func start() {
        manager.delegate = self

        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        default:
            break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        coordinate = location.coordinate
        accuracy = location.horizontalAccuracy
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}
