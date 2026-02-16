import SwiftUI

struct ContentView: View {
    @State private var viewModel = CompanyViewModel()

    var body: some View {
        TabView {
            NavigationStack {
                CompanyListView(
                    viewModel: viewModel,
                    companies: viewModel.supportCompanies,
                    title: "Support",
                    categoryColor: .blue
                )
            }
            .tabItem {
                Label("Support", systemImage: "hand.thumbsup.fill")
            }

            NavigationStack {
                CompanyListView(
                    viewModel: viewModel,
                    companies: viewModel.avoidCompanies,
                    title: "Avoid",
                    categoryColor: .red
                )
            }
            .tabItem {
                Label("Avoid", systemImage: "hand.thumbsdown.fill")
            }

            NavigationStack {
                CompanyListView(
                    viewModel: viewModel,
                    companies: viewModel.filteredCompanies,
                    title: "All Companies"
                )
            }
            .tabItem {
                Label("All", systemImage: "list.bullet")
            }

            NavigationStack {
                StatePickerView()
            }
            .tabItem {
                Label("Candidates", systemImage: "person.2.fill")
            }

            NavigationStack {
                AboutView()
            }
            .tabItem {
                Label("About", systemImage: "info.circle")
            }
        }
    }
}

#Preview {
    ContentView()
}
