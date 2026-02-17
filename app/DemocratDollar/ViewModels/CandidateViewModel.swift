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

    private(set) var stateCode: String?
    private(set) var officeCode: String?

    private var db = Firestore.firestore()
    private var listener: ListenerRegistration?

    /// Default init — loads all candidates (legacy)
    init() {
        fetchCandidates()
        fetchMetadata()
    }

    /// Load candidates for a specific state
    init(stateCode: String) {
        self.stateCode = stateCode
        fetchCandidates()
        fetchMetadata()
    }

    /// Load candidates for a specific office (e.g., Presidential)
    init(officeCode: String) {
        self.officeCode = officeCode
        fetchCandidates()
        fetchMetadata()
    }

    deinit {
        listener?.remove()
    }

    var stateDisplayName: String {
        guard let code = stateCode else { return "Candidates" }
        return StateInfo.name(for: code) ?? code
    }

    func fetchCandidates() {
        isLoading = true
        errorMessage = nil

        var query: Query = db.collection("candidates")

        if let stateCode = stateCode {
            query = query.whereField("state", isEqualTo: stateCode)
        }
        if let officeCode = officeCode {
            query = query.whereField("officeCode", isEqualTo: officeCode)
        }

        listener = query.addSnapshotListener { [weak self] snapshot, error in
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

                self.candidates = documents.compactMap { document in
                    try? document.data(as: Candidate.self)
                }
                self.errorMessage = nil
                self.isLoading = false
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

/// Helper for state name lookup
enum StateInfo {
    private static let stateNames: [String: String] = [
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
        "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
        "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
        "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
        "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
        "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
        "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
        "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
        "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
        "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
        "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
        "AS": "American Samoa", "GU": "Guam", "MP": "Northern Mariana Islands",
        "PR": "Puerto Rico", "VI": "US Virgin Islands",
    ]

    static func name(for code: String) -> String? {
        stateNames[code]
    }

    static var allStates: [(code: String, name: String)] {
        stateNames
            .sorted { $0.value < $1.value }
            .map { (code: $0.key, name: $0.value) }
    }
}
