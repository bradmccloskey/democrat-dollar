import SwiftUI
import FirebaseFirestore

struct StatePickerView: View {
    @State private var searchText = ""
    @State private var stateCounts: [String: Int] = [:]
    @State private var isLoading = true

    private var db = Firestore.firestore()

    private var filteredStates: [(code: String, name: String)] {
        let all = StateInfo.allStates
        if searchText.isEmpty { return all }
        return all.filter { state in
            state.name.localizedCaseInsensitiveContains(searchText) ||
            state.code.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var groupedStates: [(letter: String, states: [(code: String, name: String)])] {
        let grouped = Dictionary(grouping: filteredStates) { state in
            String(state.name.prefix(1))
        }
        return grouped
            .sorted { $0.key < $1.key }
            .map { (letter: $0.key, states: $0.value) }
    }

    var body: some View {
        List {
            // Presidential row at top
            Section {
                NavigationLink {
                    CandidateListView(viewModel: CandidateViewModel(officeCode: "P"))
                } label: {
                    HStack {
                        Image(systemName: "star.fill")
                            .foregroundStyle(.yellow)
                            .frame(width: 30)

                        Text("Presidential")
                            .font(.headline)

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 4)
                }
            }

            // States grouped by first letter
            ForEach(groupedStates, id: \.letter) { group in
                Section(header: Text(group.letter)) {
                    ForEach(group.states, id: \.code) { state in
                        let count = stateCounts[state.code] ?? 0
                        let hasData = count > 0 || isLoading

                        NavigationLink {
                            CandidateListView(viewModel: CandidateViewModel(stateCode: state.code))
                        } label: {
                            HStack {
                                Text(state.name)
                                    .foregroundStyle(hasData ? .primary : .tertiary)

                                Spacer()

                                Text(state.code)
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(
                                        Capsule()
                                            .fill(Color.secondary.opacity(0.15))
                                    )
                                    .foregroundStyle(.secondary)

                                if !isLoading {
                                    Text("\(count)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .frame(minWidth: 30, alignment: .trailing)
                                }
                            }
                        }
                        .disabled(!hasData)
                    }
                }
            }
        }
        .navigationTitle("Candidates")
        .searchable(
            text: $searchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search states"
        )
        .onAppear {
            loadStateCounts()
        }
    }

    private func loadStateCounts() {
        db.collection("metadata").document("candidateLastUpdate")
            .getDocument { snapshot, error in
                if let data = snapshot?.data(),
                   let counts = data["stateCounts"] as? [String: Int] {
                    self.stateCounts = counts
                }
                self.isLoading = false
            }
    }
}

#Preview {
    NavigationStack {
        StatePickerView()
    }
}
