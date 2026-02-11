import SwiftUI

struct CompanyListView: View {
    @Bindable var viewModel: CompanyViewModel
    let companies: [Company]
    let title: String
    let categoryColor: Color?

    @State private var isRefreshing = false

    init(viewModel: CompanyViewModel, companies: [Company], title: String, categoryColor: Color? = nil) {
        self.viewModel = viewModel
        self.companies = companies
        self.title = title
        self.categoryColor = categoryColor
    }

    var body: some View {
        List {
            if viewModel.isLoading && companies.isEmpty {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            } else if let error = viewModel.errorMessage, companies.isEmpty {
                ContentUnavailableView(
                    "Error Loading Data",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            } else if companies.isEmpty {
                ContentUnavailableView.search(text: viewModel.searchText)
            } else {
                Section {
                    ForEach(companies) { company in
                        NavigationLink(destination: CompanyDetailView(company: company)) {
                            CompanyRowView(company: company)
                        }
                    }
                } header: {
                    Text("\(companies.count) \(companies.count == 1 ? "Company" : "Companies")")
                }
            }
        }
        .navigationTitle(title)
        .searchable(
            text: $viewModel.searchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search companies or industries"
        )
        .refreshable {
            await viewModel.refresh()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Sort By", selection: $viewModel.sortOption) {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            Label(option.rawValue, systemImage: sortIcon(for: option))
                                .tag(option)
                        }
                    }
                } label: {
                    Label("Sort", systemImage: "arrow.up.arrow.down")
                }
            }
        }
        .overlay {
            if viewModel.isLoading && !companies.isEmpty {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        ProgressView()
                            .padding()
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color(.systemBackground))
                                    .shadow(radius: 4)
                            )
                        Spacer()
                    }
                    Spacer()
                }
                .allowsHitTesting(false)
            }
        }
    }

    private func sortIcon(for option: SortOption) -> String {
        switch option {
        case .name: return "textformat.abc"
        case .industry: return "building.2"
        case .partisanPercent: return "chart.bar"
        }
    }
}

#Preview {
    NavigationStack {
        CompanyListView(
            viewModel: CompanyViewModel(),
            companies: [
                Company(
                    id: "1",
                    name: "Apple Inc.",
                    industry: "Technology",
                    totalDemocrat: 750000,
                    totalRepublican: 250000,
                    percentDemocrat: 75.0,
                    percentRepublican: 25.0,
                    category: .support,
                    lastUpdated: Date(),
                    fecCommitteeIds: []
                ),
                Company(
                    id: "2",
                    name: "ExxonMobil",
                    industry: "Energy",
                    totalDemocrat: 200000,
                    totalRepublican: 800000,
                    percentDemocrat: 20.0,
                    percentRepublican: 80.0,
                    category: .avoid,
                    lastUpdated: Date(),
                    fecCommitteeIds: []
                )
            ],
            title: "All Companies",
            categoryColor: nil
        )
    }
}
