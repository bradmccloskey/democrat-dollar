import SwiftUI

struct CompanyRowView: View {
    let company: Company

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(company.name)
                        .font(.headline)
                        .foregroundStyle(.primary)

                    if let rank = company.rank, rank <= 500 {
                        Text("#\(rank)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                Text(company.industry)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(Color.secondary.opacity(0.15))
                    )
            }

            Spacer()

            if company.category == .none {
                Text("No PAC")
                    .font(.caption)
                    .foregroundStyle(.gray)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.gray.opacity(0.15))
                    )
            } else {
                VStack(alignment: .trailing, spacing: 4) {
                    PartisanBar(
                        democratPercent: company.percentDemocrat,
                        republicanPercent: company.percentRepublican,
                        size: .small,
                        animated: false
                    )
                    .frame(width: 100)

                    Text("\(Int(company.percentDemocrat))% Dem")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(company.name), \(company.industry), \(company.category == .none ? "No PAC" : "\(Int(company.percentDemocrat)) percent Democrat donations")")
    }
}

#Preview {
    List {
        CompanyRowView(company: Company(
            id: "1",
            name: "Apple Inc.",
            slug: "apple",
            industry: "Technology",
            totalDemocrat: 500000,
            totalRepublican: 200000,
            percentDemocrat: 71.4,
            percentRepublican: 28.6,
            category: .support,
            lastUpdated: Date(),
            fecCommitteeIds: []
        ))

        CompanyRowView(company: Company(
            id: "2",
            name: "Tesla",
            slug: "tesla",
            industry: "Automotive",
            totalDemocrat: 0,
            totalRepublican: 0,
            percentDemocrat: 0,
            percentRepublican: 0,
            category: .none,
            lastUpdated: Date(),
            fecCommitteeIds: [],
            hasPac: false
        ))
    }
}
