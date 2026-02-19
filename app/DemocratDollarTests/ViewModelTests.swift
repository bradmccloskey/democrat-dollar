import XCTest
@testable import DemocratDollar

final class ViewModelTests: XCTestCase {

    // MARK: - Category Filter Tests

    func testSupportAndAvoidCompaniesHaveZeroOverlap() throws {
        let companies = [
            makeCompany(name: "DemCo", category: .support, percentDem: 80, percentRep: 20),
            makeCompany(name: "RepCo", category: .avoid, percentDem: 20, percentRep: 80),
            makeCompany(name: "MixCo", category: .mixed, percentDem: 50, percentRep: 50),
            makeCompany(name: "NoPac", category: .none, percentDem: 0, percentRep: 0),
        ]

        let support = companies.filter { $0.category == .support }
        let avoid = companies.filter { $0.category == .avoid }

        let supportNames = Set(support.map(\.name))
        let avoidNames = Set(avoid.map(\.name))
        let overlap = supportNames.intersection(avoidNames)

        XCTAssertTrue(overlap.isEmpty, "Support and avoid should never overlap, but found: \(overlap)")
    }

    func testEveryCompanyInSupportHasSupportCategory() throws {
        let companies = [
            makeCompany(name: "A", category: .support, percentDem: 90, percentRep: 10),
            makeCompany(name: "B", category: .support, percentDem: 60, percentRep: 40),
        ]

        let support = companies.filter { $0.category == .support }
        for company in support {
            XCTAssertEqual(company.category, .support,
                "\(company.name) is in support list but has category \(company.category)")
        }
    }

    func testEveryCompanyInAvoidHasAvoidCategory() throws {
        let companies = [
            makeCompany(name: "C", category: .avoid, percentDem: 10, percentRep: 90),
            makeCompany(name: "D", category: .avoid, percentDem: 40, percentRep: 60),
        ]

        let avoid = companies.filter { $0.category == .avoid }
        for company in avoid {
            XCTAssertEqual(company.category, .avoid,
                "\(company.name) is in avoid list but has category \(company.category)")
        }
    }

    func testMixedCompaniesExcludedFromSupportAndAvoid() throws {
        let companies = [
            makeCompany(name: "MixA", category: .mixed, percentDem: 50, percentRep: 50),
            makeCompany(name: "MixB", category: .mixed, percentDem: 55, percentRep: 45),
        ]

        let support = companies.filter { $0.category == .support }
        let avoid = companies.filter { $0.category == .avoid }

        XCTAssertTrue(support.isEmpty, "Mixed companies should not appear in support")
        XCTAssertTrue(avoid.isEmpty, "Mixed companies should not appear in avoid")
    }

    func testNoPacCompaniesExcludedFromSupportAndAvoid() throws {
        let companies = [
            makeCompany(name: "NoPacA", category: .none, percentDem: 0, percentRep: 0),
        ]

        let support = companies.filter { $0.category == .support }
        let avoid = companies.filter { $0.category == .avoid }

        XCTAssertTrue(support.isEmpty, "No-PAC companies should not appear in support")
        XCTAssertTrue(avoid.isEmpty, "No-PAC companies should not appear in avoid")
    }

    // MARK: - Helpers

    private func makeCompany(
        name: String,
        category: PoliticalCategory,
        percentDem: Double,
        percentRep: Double
    ) -> Company {
        Company(
            name: name,
            industry: "Test",
            totalDemocrat: percentDem * 1000,
            totalRepublican: percentRep * 1000,
            percentDemocrat: percentDem,
            percentRepublican: percentRep,
            category: category
        )
    }
}
