import SwiftUI

struct CompanyDetailView: View {
    let company: Company

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 12) {
                    Text(company.name)
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    HStack {
                        Text(company.industry)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                Capsule()
                                    .fill(Color.secondary.opacity(0.15))
                            )

                        HStack(spacing: 6) {
                            Image(systemName: company.category.icon)
                                .font(.caption)
                            Text(company.category.displayName)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(company.category.color)
                        )
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Political Donation Split")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    PartisanBar(
                        democratPercent: company.percentDemocrat,
                        republicanPercent: company.percentRepublican,
                        size: .large
                    )

                    HStack {
                        Label {
                            Text("Democrat")
                                .font(.subheadline)
                        } icon: {
                            Circle()
                                .fill(Color.blue)
                                .frame(width: 12, height: 12)
                        }

                        Spacer()

                        Label {
                            Text("Republican")
                                .font(.subheadline)
                        } icon: {
                            Circle()
                                .fill(Color.red)
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

                VStack(alignment: .leading, spacing: 16) {
                    Text("Donation Amounts")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    VStack(spacing: 12) {
                        DonationRow(
                            label: "Democrat Donations",
                            amount: company.formattedTotalDemocrat,
                            color: .blue
                        )

                        Divider()

                        DonationRow(
                            label: "Republican Donations",
                            amount: company.formattedTotalRepublican,
                            color: .red
                        )

                        Divider()

                        DonationRow(
                            label: "Total Donations",
                            amount: company.formattedTotalDonations,
                            color: .primary,
                            isBold: true
                        )
                    }
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.systemBackground))
                        .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
                )

                VStack(alignment: .leading, spacing: 8) {
                    Label {
                        Text("Last Updated: \(company.formattedLastUpdated)")
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
        \(company.name)
        Industry: \(company.industry)
        Category: \(company.category.displayName)

        Political Donations:
        Democrat: \(company.formattedTotalDemocrat) (\(Int(company.percentDemocrat))%)
        Republican: \(company.formattedTotalRepublican) (\(Int(company.percentRepublican))%)
        Total: \(company.formattedTotalDonations)

        Data from DemocratDollar app
        Source: Federal Election Commission (FEC)
        """
    }
}

struct DonationRow: View {
    let label: String
    let amount: String
    let color: Color
    var isBold: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(isBold ? .subheadline.bold() : .subheadline)
                .foregroundStyle(color)

            Spacer()

            Text(amount)
                .font(isBold ? .title3.bold() : .title3)
                .foregroundStyle(color)
        }
    }
}

#Preview {
    NavigationStack {
        CompanyDetailView(company: Company(
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
        ))
    }
}
