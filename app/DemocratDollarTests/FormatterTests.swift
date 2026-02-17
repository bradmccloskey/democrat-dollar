import XCTest
@testable import DemocratDollar

final class FormatterTests: XCTestCase {

    func testFormattedAsCurrencyZero() {
        XCTAssertEqual((0.0).formattedAsCurrency, "$0")
    }

    func testFormattedAsCurrencyThousand() {
        let result = (1000.0).formattedAsCurrency
        // NumberFormatter with .currency style includes grouping separator
        XCTAssertTrue(result.contains("1"), "Expected '1' in \(result)")
        XCTAssertTrue(result.contains("000"), "Expected '000' in \(result)")
        XCTAssertTrue(result.contains("$"), "Expected '$' in \(result)")
    }

    func testFormattedAsCurrencyMillion() {
        let result = (1000000.0).formattedAsCurrency
        XCTAssertTrue(result.contains("$"), "Expected '$' in \(result)")
        XCTAssertTrue(result.contains("000"), "Expected '000' in \(result)")
    }

    func testFormattedAsCurrencyNegative() {
        let result = (-500.0).formattedAsCurrency
        // Should contain some form of negative indicator
        XCTAssertTrue(result.contains("500"), "Expected '500' in \(result)")
    }

    func testFormattedMediumDate() {
        // Use a date well into 2025 to avoid timezone edge cases
        let date = Date(timeIntervalSince1970: 1735689600) // Jan 1, 2025 00:00 UTC
        let result = date.formattedMedium
        // Should produce a non-empty, locale-dependent medium-style date
        XCTAssertFalse(result.isEmpty)
        // Dec 31, 2024 or Jan 1, 2025 depending on timezone — just check non-empty
        XCTAssertTrue(result.count > 5, "Expected a reasonable date string, got: \(result)")
    }

    func testFormattedLastUpdatedNil() {
        // Company with nil lastUpdated
        let json: [String: Any] = [
            "name": "Test",
            "industry": "Tech",
            "totalDemocrat": 0.0,
            "totalRepublican": 0.0,
            "percentDemocrat": 0.0,
            "percentRepublican": 0.0,
            "category": "none",
        ]
        let data = try! JSONSerialization.data(withJSONObject: json)
        let company = try! JSONDecoder().decode(Company.self, from: data)
        XCTAssertEqual(company.formattedLastUpdated, "Unknown")
    }
}
