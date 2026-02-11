import SwiftUI
import FirebaseCore

@main
struct DemocratDollarApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
