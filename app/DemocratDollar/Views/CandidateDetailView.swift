import SwiftUI

struct CandidateDetailView: View {
    let candidate: Candidate

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 12) {
                    Text(candidate.name)
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    HStack(spacing: 8) {
                        // Party badge
                        HStack(spacing: 6) {
                            Circle()
                                .fill(.white.opacity(0.3))
                                .frame(width: 8, height: 8)
                            Text(candidate.partyDisplayName)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(candidate.partyColor)
                        )

                        // Office badge
                        Text(candidate.office)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                Capsule()
                                    .fill(Color.secondary.opacity(0.15))
                            )

                        if let status = candidate.statusLabel {
                            Text(status)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(
                                    Capsule()
                                        .strokeBorder(Color.secondary.opacity(0.3), lineWidth: 1)
                                )
                        }
                    }
                }

                // Fundraising overview card
                VStack(alignment: .leading, spacing: 16) {
                    Text("Fundraising Overview")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    VStack(spacing: 12) {
                        FundraisingRow(
                            label: "Total Raised",
                            amount: candidate.formattedTotalRaised,
                            color: .primary,
                            isBold: true
                        )

                        Divider()

                        FundraisingRow(
                            label: "From PACs",
                            amount: candidate.formattedTotalFromPacs,
                            percentage: candidate.pacPercentage,
                            color: .orange
                        )

                        Divider()

                        FundraisingRow(
                            label: "From Individuals",
                            amount: candidate.formattedTotalFromIndividuals,
                            percentage: candidate.individualPercentage,
                            color: .green
                        )
                    }
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.systemBackground))
                        .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
                )

                // Funding source bar
                VStack(alignment: .leading, spacing: 12) {
                    Text("Funding Sources")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    FundingSourceBar(
                        pacPercent: candidate.pacPercentage,
                        individualPercent: candidate.individualPercentage
                    )

                    HStack {
                        Label {
                            Text("PACs")
                                .font(.subheadline)
                        } icon: {
                            Circle()
                                .fill(Color.orange)
                                .frame(width: 12, height: 12)
                        }

                        Spacer()

                        Label {
                            Text("Individuals")
                                .font(.subheadline)
                        } icon: {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 12, height: 12)
                        }
                    }
                    .foregroundStyle(.secondary)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.systemBackground))
                        .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
                )

                // Top donors list
                if !candidate.topDonors.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Top Donors")
                            .font(.headline)
                            .foregroundStyle(.secondary)

                        // PAC donors
                        let pacDonors = candidate.topDonors.filter { $0.type == "pac" }
                        if !pacDonors.isEmpty {
                            Text("PACs & Organizations")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(.orange)
                                .padding(.top, 4)

                            ForEach(Array(pacDonors.prefix(15))) { donor in
                                DonorRowView(donor: donor)
                            }
                        }

                        // Individual donors
                        let individualDonors = candidate.topDonors.filter { $0.type == "individual" }
                        if !individualDonors.isEmpty {
                            Text("Individual Contributors")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(.green)
                                .padding(.top, 8)

                            ForEach(Array(individualDonors.prefix(15))) { donor in
                                DonorRowView(donor: donor)
                            }
                        }
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(.systemBackground))
                            .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
                    )
                }

                // Footer info
                VStack(alignment: .leading, spacing: 8) {
                    Label {
                        Text("Last Updated: \(candidate.formattedLastUpdated)")
                            .font(.caption)
                    } icon: {
                        Image(systemName: "clock")
                            .font(.caption)
                    }
                    .foregroundStyle(.secondary)

                    Label {
                        Text("Data source: Federal Election Commission (FEC)")
                            .font(.caption)
                    } icon: {
                        Image(systemName: "doc.text")
                            .font(.caption)
                    }
                    .foregroundStyle(.secondary)
                }
                .padding(.top, 8)
            }
            .padding()
        }
        .background(Color(.secondarySystemBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: shareText) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
    }

    private var shareText: String {
        """
        \(candidate.name) (\(candidate.partyAbbreviation))
        Office: \(candidate.office)

        Fundraising:
        Total Raised: \(candidate.formattedTotalRaised)
        From PACs: \(candidate.formattedTotalFromPacs) (\(Int(candidate.pacPercentage))%)
        From Individuals: \(candidate.formattedTotalFromIndividuals) (\(Int(candidate.individualPercentage))%)
        Total Donors: \(candidate.donorCount)

        Data from DemocratDollar app
        Source: Federal Election Commission (FEC)
        """
    }
}

struct FundraisingRow: View {
    let label: String
    let amount: String
    var percentage: Double? = nil
    let color: Color
    var isBold: Bool = false

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(isBold ? .subheadline.bold() : .subheadline)
                    .foregroundStyle(color)

                if let percentage = percentage {
                    Text("\(Int(percentage))% of total")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Text(amount)
                .font(isBold ? .title3.bold() : .title3)
                .foregroundStyle(color)
        }
    }
}

struct FundingSourceBar: View {
    let pacPercent: Double
    let individualPercent: Double

    @State private var animatedPacPercent: Double = 0

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Individual (green) background
                Rectangle()
                    .fill(Color.green.opacity(0.8))
                    .frame(width: geometry.size.width, height: 40)

                // PAC (orange) foreground
                Rectangle()
                    .fill(Color.orange.opacity(0.8))
                    .frame(
                        width: geometry.size.width * animatedPacPercent / 100,
                        height: 40
                    )

                // Other (gray) if there's a gap
                let otherPercent = max(0, 100 - pacPercent - individualPercent)
                if otherPercent > 5 {
                    Rectangle()
                        .fill(Color.gray.opacity(0.5))
                        .frame(
                            width: geometry.size.width * otherPercent / 100,
                            height: 40
                        )
                        .offset(x: geometry.size.width * (pacPercent + individualPercent) / 100)
                }

                // Labels
                HStack {
                    if pacPercent > 15 {
                        Text("\(Int(pacPercent))%")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .padding(.leading, 8)
                    }

                    Spacer()

                    if individualPercent > 15 {
                        Text("\(Int(individualPercent))%")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .padding(.trailing, 8)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 20))
        }
        .frame(height: 40)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.8)) {
                animatedPacPercent = pacPercent
            }
        }
    }
}

struct DonorRowView: View {
    let donor: Donor

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: donor.typeIcon)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 16)

            VStack(alignment: .leading, spacing: 2) {
                Text(donor.displayName)
                    .font(.subheadline)
                    .lineLimit(1)

                if let employer = donor.employer, !employer.isEmpty {
                    Text(employer.capitalized)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(donor.formattedAmount)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text("\(donor.contributionCount) contribution\(donor.contributionCount == 1 ? "" : "s")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    NavigationStack {
        CandidateDetailView(candidate: Candidate(
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
            topDonors: [
                Donor(name: "ACTBLUE", type: "pac", totalAmount: 500000, contributionCount: 12500, employer: nil, state: "MA"),
                Donor(name: "EMILY'S LIST", type: "pac", totalAmount: 75000, contributionCount: 3, employer: nil, state: "DC"),
                Donor(name: "JOHN Q PUBLIC", type: "individual", totalAmount: 6600, contributionCount: 2, employer: "TECH CORP", state: "NC"),
            ],
            committeeId: "C00123456",
            lastUpdated: Date()
        ))
    }
}
