import Foundation
import SwiftUI
import FirebaseFirestore

struct Donor: Codable, Identifiable {
    var id: String { "\(type):\(name)" }
    var name: String
    var type: String // "pac", "individual", "other"
    var totalAmount: Double
    var contributionCount: Int
    var employer: String?
    var state: String?

    var displayName: String {
        // FEC names are all caps — convert to title case
        name.split(separator: " ")
            .map { word in
                let lower = word.lowercased()
                // Keep common abbreviations uppercase
                if ["pac", "llc", "inc", "corp", "co", "lp", "ii", "iii"].contains(lower) {
                    return word.uppercased()
                }
                return lower.capitalized
            }
            .joined(separator: " ")
    }

    var typeLabel: String {
        switch type {
        case "pac": return "PAC"
        case "individual": return "Individual"
        default: return "Other"
        }
    }

    var typeIcon: String {
        switch type {
        case "pac": return "building.2.fill"
        case "individual": return "person.fill"
        default: return "questionmark.circle"
        }
    }

    var formattedAmount: String {
        formatCurrency(totalAmount)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "$0"
    }
}

struct Candidate: Identifiable, Codable {
    @DocumentID var id: String?
    var candidateId: String
    var name: String
    var party: String
    var office: String
    var officeCode: String
    var district: String?
    var state: String
    var incumbentChallenger: String?
    var totalRaised: Double
    var totalFromPacs: Double
    var totalFromIndividuals: Double
    var donorCount: Int
    var topDonors: [Donor]
    var committeeId: String?
    var lastUpdated: Date?

    var partyDisplayName: String {
        switch party {
        case "DEM": return "Democrat"
        case "REP": return "Republican"
        case "LIB": return "Libertarian"
        case "GRE": return "Green"
        case "IND": return "Independent"
        default: return party
        }
    }

    var partyColor: Color {
        switch party {
        case "DEM": return .blue
        case "REP": return .red
        case "LIB": return .yellow
        case "GRE": return .green
        default: return .gray
        }
    }

    var partyAbbreviation: String {
        switch party {
        case "DEM": return "D"
        case "REP": return "R"
        case "LIB": return "L"
        case "GRE": return "G"
        default: return party.prefix(1).uppercased()
        }
    }

    var statusLabel: String? {
        switch incumbentChallenger {
        case "I": return "Incumbent"
        case "C": return "Challenger"
        case "O": return "Open Seat"
        default: return nil
        }
    }

    var pacPercentage: Double {
        guard totalRaised > 0 else { return 0 }
        return (totalFromPacs / totalRaised) * 100
    }

    var individualPercentage: Double {
        guard totalRaised > 0 else { return 0 }
        return (totalFromIndividuals / totalRaised) * 100
    }

    var formattedTotalRaised: String {
        formatCurrency(totalRaised)
    }

    var formattedTotalFromPacs: String {
        formatCurrency(totalFromPacs)
    }

    var formattedTotalFromIndividuals: String {
        formatCurrency(totalFromIndividuals)
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
