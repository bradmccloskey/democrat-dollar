import SwiftUI

struct CandidateRowView: View {
    let candidate: Candidate

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // Party color indicator
            Circle()
                .fill(candidate.partyColor)
                .frame(width: 36, height: 36)
                .overlay(
                    Text(candidate.partyAbbreviation)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(candidate.name)
                    .font(.headline)
                    .foregroundStyle(.primary)

                HStack(spacing: 8) {
                    Text(candidate.office)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(Color.secondary.opacity(0.15))
                        )

                    if let status = candidate.statusLabel {
                        Text(status)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(candidate.formattedTotalRaised)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)

                Text("\(candidate.donorCount) donors")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(candidate.name), \(candidate.partyDisplayName), \(candidate.office), raised \(candidate.formattedTotalRaised)")
    }
}

#Preview {
    List {
        CandidateRowView(candidate: Candidate(
            id: "1",
            candidateId: "S2NC00123",
            name: "Jane Smith",
            party: "DEM",
            office: "US Senate",
            officeCode: "S",
            district: nil,
            state: "NC",
            incumbentChallenger: "I",
            totalRaised: 5250000,
            totalFromPacs: 2100000,
            totalFromIndividuals: 3150000,
            donorCount: 1523,
            topDonors: [],
            committeeId: "C00123456",
            lastUpdated: Date()
        ))

        CandidateRowView(candidate: Candidate(
            id: "2",
            candidateId: "H2NC02456",
            name: "John Doe",
            party: "REP",
            office: "US House NC-02",
            officeCode: "H",
            district: "02",
            state: "NC",
            incumbentChallenger: "C",
            totalRaised: 1850000,
            totalFromPacs: 750000,
            totalFromIndividuals: 1100000,
            donorCount: 843,
            topDonors: [],
            committeeId: "C00789012",
            lastUpdated: Date()
        ))
    }
}
