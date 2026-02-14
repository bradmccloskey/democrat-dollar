import Foundation
import SwiftUI
import FirebaseFirestore

enum OfficeFilter: String, CaseIterable {
    case all = "All"
    case senate = "US Senate"
    case house = "US House"

    var officeCode: String? {
        switch self {
        case .all: return nil
        case .senate: return "S"
        case .house: return "H"
        }
    }
}

enum PartyFilter: String, CaseIterable {
    case all = "All"
    case democrat = "Democrat"
    case republican = "Republican"

    var partyCode: String? {
        switch self {
        case .all: return nil
        case .democrat: return "DEM"
        case .republican: return "REP"
        }
    }

    var color: Color {
        switch self {
        case .all: return .primary
        case .democrat: return .blue
        case .republican: return .red
        }
    }
}

enum CandidateSortOption: String, CaseIterable {
    case name = "Name"
    case totalRaised = "Total Raised"
    case office = "Office"
}

@Observable
class CandidateViewModel {
    var candidates: [Candidate] = []
    var searchText: String = ""
    var officeFilter: OfficeFilter = .all
    var partyFilter: PartyFilter = .all
    var sortOption: CandidateSortOption = .totalRaised
    var isLoading: Bool = true
    var errorMessage: String?
    var lastUpdateDate: Date?

    private var db = Firestore.firestore()
    private var listener: ListenerRegistration?

    init() {
        fetchCandidates()
        fetchMetadata()
    }

    deinit {
        listener?.remove()
    }

    func fetchCandidates() {
        isLoading = true
        errorMessage = nil

        listener = db.collection("candidates")
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }

                if let error = error {
                    self.errorMessage = "Failed to load candidates: \(error.localizedDescription)"
                    self.isLoading = false
                    return
                }

                guard let documents = snapshot?.documents else {
                    self.errorMessage = "No candidates found"
                    self.isLoading = false
                    return
                }

                do {
                    self.candidates = try documents.compactMap { document in
                        try document.data(as: Candidate.self)
                    }
                    self.isLoading = false
                } catch {
                    self.errorMessage = "Failed to parse candidates: \(error.localizedDescription)"
                    self.isLoading = false
                }
            }
    }

    func fetchMetadata() {
        db.collection("metadata").document("candidateLastUpdate")
            .getDocument { [weak self] snapshot, error in
                if let data = snapshot?.data(),
                   let timestamp = data["timestamp"] as? Timestamp {
                    self?.lastUpdateDate = timestamp.dateValue()
                }
            }
    }

    func refresh() async {
        fetchMetadata()
    }

    var filteredCandidates: [Candidate] {
        var filtered = candidates

        // Apply search filter
        if !searchText.isEmpty {
            filtered = filtered.filter { candidate in
                candidate.name.localizedCaseInsensitiveContains(searchText) ||
                candidate.office.localizedCaseInsensitiveContains(searchText) ||
                candidate.partyDisplayName.localizedCaseInsensitiveContains(searchText)
            }
        }

        // Apply office filter
        if let officeCode = officeFilter.officeCode {
            filtered = filtered.filter { $0.officeCode == officeCode }
        }

        // Apply party filter
        if let partyCode = partyFilter.partyCode {
            filtered = filtered.filter { $0.party == partyCode }
        }

        return sortCandidates(filtered)
    }

    var democratCandidates: [Candidate] {
        sortCandidates(filteredCandidates.filter { $0.party == "DEM" })
    }

    var republicanCandidates: [Candidate] {
        sortCandidates(filteredCandidates.filter { $0.party == "REP" })
    }

    var availableOffices: [String] {
        Array(Set(candidates.map(\.office))).sorted()
    }

    private func sortCandidates(_ candidates: [Candidate]) -> [Candidate] {
        switch sortOption {
        case .name:
            return candidates.sorted { $0.name < $1.name }
        case .totalRaised:
            return candidates.sorted { $0.totalRaised > $1.totalRaised }
        case .office:
            return candidates.sorted {
                if $0.office != $1.office {
                    return $0.office < $1.office
                }
                return $0.totalRaised > $1.totalRaised
            }
        }
    }
}
