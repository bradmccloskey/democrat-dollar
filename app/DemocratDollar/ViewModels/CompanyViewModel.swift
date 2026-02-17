import Foundation
import SwiftUI
import FirebaseFirestore

enum SortOption: String, CaseIterable {
    case name = "Name"
    case industry = "Industry"
    case partisanPercent = "Partisan %"
    case fortune500Rank = "Fortune 500 Rank"
}

@Observable
class CompanyViewModel {
    var companies: [Company] = []
    var searchText: String = ""
    var sortOption: SortOption = .name
    var industryFilter: String? = nil
    var isLoading: Bool = true
    var errorMessage: String?
    var lastUpdateDate: Date?

    private var db = Firestore.firestore()
    private var listener: ListenerRegistration?

    init() {
        setupFirestore()
        fetchCompanies()
        fetchMetadata()
    }

    deinit {
        listener?.remove()
    }

    private func setupFirestore() {
        let settings = FirestoreSettings()
        settings.cacheSettings = PersistentCacheSettings()
        db.settings = settings
    }

    func fetchCompanies() {
        isLoading = true
        errorMessage = nil

        listener = db.collection("companies")
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }

                if let error = error {
                    self.errorMessage = "Failed to load companies: \(error.localizedDescription)"
                    self.isLoading = false
                    return
                }

                guard let documents = snapshot?.documents else {
                    self.errorMessage = "No companies found"
                    self.isLoading = false
                    return
                }

                self.companies = documents.compactMap { document in
                    try? document.data(as: Company.self)
                }
                self.errorMessage = nil
                self.isLoading = false
            }
    }

    func fetchMetadata() {
        db.collection("metadata").document("lastUpdate")
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

    var availableIndustries: [String] {
        Array(Set(companies.map(\.industry))).sorted()
    }

    var filteredCompanies: [Company] {
        var filtered = companies

        // Apply search filter
        if !searchText.isEmpty {
            filtered = filtered.filter { company in
                company.name.localizedCaseInsensitiveContains(searchText) ||
                company.industry.localizedCaseInsensitiveContains(searchText)
            }
        }

        // Apply industry filter
        if let industry = industryFilter {
            filtered = filtered.filter { $0.industry == industry }
        }

        return sortCompanies(filtered)
    }

    var supportCompanies: [Company] {
        sortCompanies(filteredCompanies.filter { $0.category == .support })
    }

    var avoidCompanies: [Company] {
        sortCompanies(filteredCompanies.filter { $0.category == .avoid })
    }

    var mixedCompanies: [Company] {
        sortCompanies(filteredCompanies.filter { $0.category == .mixed })
    }

    var noPacCompanies: [Company] {
        sortCompanies(filteredCompanies.filter { $0.category == .none })
    }

    private func sortCompanies(_ companies: [Company]) -> [Company] {
        switch sortOption {
        case .name:
            return companies.sorted { $0.name < $1.name }
        case .industry:
            return companies.sorted { $0.industry < $1.industry }
        case .partisanPercent:
            return companies.sorted { $0.percentDemocrat > $1.percentDemocrat }
        case .fortune500Rank:
            return companies.sorted {
                ($0.rank ?? Int.max) < ($1.rank ?? Int.max)
            }
        }
    }
}
