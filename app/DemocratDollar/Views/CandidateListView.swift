import SwiftUI

struct CandidateListView: View {
    @Bindable var viewModel: CandidateViewModel

    @State private var isRefreshing = false

    var body: some View {
        List {
            if viewModel.isLoading && viewModel.candidates.isEmpty {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            } else if let error = viewModel.errorMessage, viewModel.candidates.isEmpty {
                ContentUnavailableView(
                    "Error Loading Data",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            } else if viewModel.filteredCandidates.isEmpty {
                ContentUnavailableView.search(text: viewModel.searchText)
            } else {
                // Filter chips
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            // Office filter
                            ForEach(OfficeFilter.allCases, id: \.self) { filter in
                                FilterChip(
                                    label: filter.rawValue,
                                    isSelected: viewModel.officeFilter == filter
                                ) {
                                    viewModel.officeFilter = filter
                                }
                            }

                            Divider()
                                .frame(height: 24)

                            // Party filter
                            ForEach(PartyFilter.allCases, id: \.self) { filter in
                                FilterChip(
                                    label: filter.rawValue,
                                    isSelected: viewModel.partyFilter == filter,
                                    activeColor: filter.color
                                ) {
                                    viewModel.partyFilter = filter
                                }
                            }
                        }
                        .padding(.horizontal, 4)
                    }
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))

                // Candidate list
                Section {
                    ForEach(viewModel.filteredCandidates) { candidate in
                        NavigationLink(destination: CandidateDetailView(candidate: candidate)) {
                            CandidateRowView(candidate: candidate)
                        }
                    }
                } header: {
                    Text("\(viewModel.filteredCandidates.count) \(viewModel.filteredCandidates.count == 1 ? "Candidate" : "Candidates")")
                }
            }
        }
        .navigationTitle("Candidates")
        .searchable(
            text: $viewModel.searchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search candidates"
        )
        .refreshable {
            await viewModel.refresh()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Sort By", selection: $viewModel.sortOption) {
                        ForEach(CandidateSortOption.allCases, id: \.self) { option in
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
            if viewModel.isLoading && !viewModel.candidates.isEmpty {
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

    private func sortIcon(for option: CandidateSortOption) -> String {
        switch option {
        case .name: return "textformat.abc"
        case .totalRaised: return "dollarsign.circle"
        case .office: return "building.columns"
        }
    }
}

struct FilterChip: View {
    let label: String
    let isSelected: Bool
    var activeColor: Color = .accentColor

    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(isSelected ? activeColor.opacity(0.15) : Color.secondary.opacity(0.1))
                )
                .foregroundStyle(isSelected ? activeColor : .secondary)
                .overlay(
                    Capsule()
                        .strokeBorder(isSelected ? activeColor.opacity(0.4) : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        CandidateListView(viewModel: CandidateViewModel())
    }
}
