import SwiftUI

struct AboutView: View {
    @Environment(\.openURL) private var openURL

    private let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    private let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "dollarsign.circle.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(.blue)

                        Spacer()
                    }

                    Text("DemocratDollar helps you make informed purchasing decisions by showing how companies' Political Action Committees (PACs) distribute their donations between political parties.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 8)
            }

            Section("How It Works") {
                InfoRow(
                    icon: "doc.text.magnifyingglass",
                    title: "Data Collection",
                    description: "We aggregate Federal Election Commission (FEC) public records to track PAC contributions."
                )

                InfoRow(
                    icon: "chart.bar.fill",
                    title: "Analysis",
                    description: "Companies are analyzed based on their total donations to Democrat and Republican candidates."
                )

                InfoRow(
                    icon: "tag.fill",
                    title: "Categorization",
                    description: "Companies are categorized to help you quickly identify their political leanings."
                )
            }

            Section("Categories Explained") {
                CategoryExplanationRow(
                    category: .support,
                    threshold: ">55% Democrat donations"
                )

                CategoryExplanationRow(
                    category: .avoid,
                    threshold: ">55% Republican donations"
                )

                CategoryExplanationRow(
                    category: .mixed,
                    threshold: "45-55% split between parties"
                )
            }

            Section("Methodology") {
                VStack(alignment: .leading, spacing: 12) {
                    MethodologyPoint(
                        icon: "building.2.fill",
                        text: "Data represents PAC contributions from companies to federal candidates"
                    )

                    MethodologyPoint(
                        icon: "calendar",
                        text: "Database updated every 2 weeks from FEC records"
                    )

                    MethodologyPoint(
                        icon: "percent",
                        text: "Percentages calculated from total contributions to each party"
                    )

                    MethodologyPoint(
                        icon: "checkmark.shield.fill",
                        text: "All data sourced from official FEC public records"
                    )
                }
                .padding(.vertical, 4)
            }

            Section("Data Source") {
                Button {
                    if let url = URL(string: "https://www.fec.gov") {
                        openURL(url)
                    }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Federal Election Commission")
                                .font(.headline)
                            Text("fec.gov")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(.blue)
                    }
                }

                Text("The FEC is the independent regulatory agency charged with administering and enforcing federal campaign finance law.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            }

            Section("Privacy") {
                Label {
                    Text("This app does not collect, store, or transmit any personal data. All company information is publicly available from the FEC.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } icon: {
                    Image(systemName: "lock.shield.fill")
                        .foregroundStyle(.green)
                }
            }

            Section("About") {
                HStack {
                    Text("Version")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(appVersion) (\(buildNumber))")
                }

                HStack {
                    Text("Data Provider")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("FEC")
                }
            }
        }
        .navigationTitle("About")
    }
}

struct InfoRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.blue)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct CategoryExplanationRow: View {
    let category: PoliticalCategory
    let threshold: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: category.icon)
                .font(.title3)
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(
                    Circle()
                        .fill(category.color)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(category.displayName)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(threshold)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct MethodologyPoint: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(.blue)
                .frame(width: 20)

            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    NavigationStack {
        AboutView()
    }
}
