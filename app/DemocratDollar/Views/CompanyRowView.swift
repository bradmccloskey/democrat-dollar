import SwiftUI

struct CompanyRowView: View {
    let company: Company

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(company.name)
                    .font(.headline)
                    .foregroundStyle(.primary)

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
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(company.name), \(company.industry), \(Int(company.percentDemocrat)) percent Democrat donations")
    }
}

#Preview {
    List {
        CompanyRowView(company: Company(
            id: "1",
            name: "Apple Inc.",
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
            name: "ExxonMobil",
            industry: "Energy",
            totalDemocrat: 200000,
            totalRepublican: 800000,
            percentDemocrat: 20.0,
            percentRepublican: 80.0,
            category: .avoid,
            lastUpdated: Date(),
            fecCommitteeIds: []
        ))
    }
}
