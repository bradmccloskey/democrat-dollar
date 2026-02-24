import XCTest
@testable import DemocratDollar

final class CompanyDecodingTests: XCTestCase {

    func testDecodeValidCompany() throws {
        let json: [String: Any] = [
            "name": "Walmart",
            "slug": "walmart",
            "industry": "Retail",
            "totalDemocrat": 232750.0,
            "totalRepublican": 635750.0,
            "percentDemocrat": 26.8,
            "percentRepublican": 73.2,
            "category": "avoid",
            "lastUpdated": "2025-01-15T00:00:00Z",
            "fecCommitteeIds": ["C00093054"],
            "rank": 1,
            "hasPac": true,
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let company = try decoder.decode(Company.self, from: data)
        XCTAssertEqual(company.name, "Walmart")
        XCTAssertEqual(company.slug, "walmart")
        XCTAssertEqual(company.industry, "Retail")
        XCTAssertEqual(company.totalDemocrat, 232750.0)
        XCTAssertEqual(company.totalRepublican, 635750.0)
        XCTAssertEqual(company.percentDemocrat, 26.8)
        XCTAssertEqual(company.percentRepublican, 73.2)
        XCTAssertEqual(company.category, .avoid)
        XCTAssertNotNil(company.lastUpdated)
        XCTAssertEqual(company.fecCommitteeIds, ["C00093054"])
        XCTAssertEqual(company.rank, 1)
        XCTAssertEqual(company.hasPac, true)
    }

    func testDecodeWithMissingOptionalFields() throws {
        let json: [String: Any] = [
            "name": "Test Corp",
            "industry": "Tech",
            "totalDemocrat": 0.0,
            "totalRepublican": 0.0,
            "percentDemocrat": 0.0,
            "percentRepublican": 0.0,
            "category": "none",
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        let company = try JSONDecoder().decode(Company.self, from: data)

        XCTAssertEqual(company.name, "Test Corp")
        XCTAssertEqual(company.category, .none)
        XCTAssertNil(company.fecCommitteeIds)
        XCTAssertNil(company.rank)
        XCTAssertNil(company.hasPac)
        XCTAssertNil(company.lastUpdated)
    }

    func testDecodeIgnoresUnknownFields() throws {
        let json: [String: Any] = [
            "name": "Extra Corp",
            "industry": "Finance",
            "totalDemocrat": 100.0,
            "totalRepublican": 200.0,
            "percentDemocrat": 33.3,
            "percentRepublican": 66.7,
            "category": "avoid",
            "slug": "extra-corp",
            "totalOther": 50.0,
            "disbursementCount": 42,
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        // Should not throw despite extra fields
        let company = try JSONDecoder().decode(Company.self, from: data)
        XCTAssertEqual(company.name, "Extra Corp")
    }

    func testDecodeWithZeroAmounts() throws {
        let json: [String: Any] = [
            "name": "Zero Corp",
            "industry": "Energy",
            "totalDemocrat": 0.0,
            "totalRepublican": 0.0,
            "percentDemocrat": 0.0,
            "percentRepublican": 0.0,
            "category": "none",
            "hasPac": false,
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        let company = try JSONDecoder().decode(Company.self, from: data)

        XCTAssertEqual(company.totalDemocrat, 0)
        XCTAssertEqual(company.totalRepublican, 0)
        XCTAssertEqual(company.totalDonations, 0)
        XCTAssertEqual(company.category, .none)
        XCTAssertEqual(company.hasPac, false)
    }
}
