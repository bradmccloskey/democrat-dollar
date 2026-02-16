import Foundation
import SwiftUI
import FirebaseFirestore

enum PoliticalCategory: String, Codable, CaseIterable {
    case support = "support"
    case avoid = "avoid"
    case mixed = "mixed"
    case none = "none"

    var displayName: String {
        switch self {
        case .support: return "Support"
        case .avoid: return "Avoid"
        case .mixed: return "Mixed"
        case .none: return "No PAC"
        }
    }

    var color: Color {
        switch self {
        case .support: return .blue
        case .avoid: return .red
        case .mixed: return .purple
        case .none: return .gray
        }
    }

    var icon: String {
        switch self {
        case .support: return "hand.thumbsup.fill"
        case .avoid: return "hand.thumbsdown.fill"
        case .mixed: return "equal.circle.fill"
        case .none: return "minus.circle.fill"
        }
    }
}

struct Company: Identifiable, Codable {
    @DocumentID var id: String?
    var name: String
    var industry: String
    var totalDemocrat: Double
    var totalRepublican: Double
    var percentDemocrat: Double
    var percentRepublican: Double
    var category: PoliticalCategory
    var lastUpdated: Date?
    var fecCommitteeIds: [String]?
    var rank: Int?
    var hasPac: Bool?

    var totalDonations: Double {
        totalDemocrat + totalRepublican
    }

    var formattedTotalDemocrat: String {
        formatCurrency(totalDemocrat)
    }

    var formattedTotalRepublican: String {
        formatCurrency(totalRepublican)
    }

    var formattedTotalDonations: String {
        formatCurrency(totalDonations)
    }

    var formattedLastUpdated: String {
        guard let date = lastUpdated else { return "Unknown" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "$0"
    }
}
