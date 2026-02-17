import XCTest
@testable import DemocratDollar

final class CandidateDecodingTests: XCTestCase {

    func testDecodeValidCandidateWithTopDonors() throws {
        let json: [String: Any] = [
            "candidateId": "H4NC01234",
            "name": "Jane Smith",
            "party": "DEM",
            "office": "US House NC-4",
            "officeCode": "H",
            "district": "04",
            "state": "NC",
            "incumbentChallenger": "I",
            "totalRaised": 150000.0,
            "totalFromPacs": 50000.0,
            "totalFromIndividuals": 100000.0,
            "donorCount": 250,
            "topDonors": [
                [
                    "name": "ACME PAC",
                    "type": "pac",
                    "totalAmount": 5000.0,
                    "contributionCount": 1,
                    "state": "DC",
                ],
                [
                    "name": "JOHN DOE",
                    "type": "individual",
                    "totalAmount": 2800.0,
                    "contributionCount": 2,
                    "employer": "Google",
                    "state": "CA",
                ],
            ],
            "committeeId": "C00123456",
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        let candidate = try JSONDecoder().decode(Candidate.self, from: data)

        XCTAssertEqual(candidate.candidateId, "H4NC01234")
        XCTAssertEqual(candidate.name, "Jane Smith")
        XCTAssertEqual(candidate.party, "DEM")
        XCTAssertEqual(candidate.office, "US House NC-4")
        XCTAssertEqual(candidate.officeCode, "H")
        XCTAssertEqual(candidate.district, "04")
        XCTAssertEqual(candidate.state, "NC")
        XCTAssertEqual(candidate.incumbentChallenger, "I")
        XCTAssertEqual(candidate.totalRaised, 150000.0)
        XCTAssertEqual(candidate.totalFromPacs, 50000.0)
        XCTAssertEqual(candidate.totalFromIndividuals, 100000.0)
        XCTAssertEqual(candidate.donorCount, 250)
        XCTAssertEqual(candidate.topDonors.count, 2)
        XCTAssertEqual(candidate.committeeId, "C00123456")

        // Verify first donor
        let donor1 = candidate.topDonors[0]
        XCTAssertEqual(donor1.name, "ACME PAC")
        XCTAssertEqual(donor1.type, "pac")
        XCTAssertEqual(donor1.totalAmount, 5000.0)
        XCTAssertEqual(donor1.contributionCount, 1)
        XCTAssertEqual(donor1.state, "DC")
    }

    func testDecodeWithEmptyTopDonors() throws {
        let json: [String: Any] = [
            "candidateId": "S6VA00001",
            "name": "Bob Johnson",
            "party": "REP",
            "office": "US Senate",
            "officeCode": "S",
            "state": "VA",
            "totalRaised": 500.0,
            "totalFromPacs": 0.0,
            "totalFromIndividuals": 500.0,
            "donorCount": 1,
            "topDonors": [] as [[String: Any]],
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        let candidate = try JSONDecoder().decode(Candidate.self, from: data)

        XCTAssertEqual(candidate.topDonors.count, 0)
        XCTAssertEqual(candidate.totalRaised, 500.0)
    }

    func testDecodeDonorWithMissingOptionalFields() throws {
        let json: [String: Any] = [
            "name": "MYSTERY DONOR",
            "type": "other",
            "totalAmount": 1000.0,
            "contributionCount": 1,
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        let donor = try JSONDecoder().decode(Donor.self, from: data)

        XCTAssertEqual(donor.name, "MYSTERY DONOR")
        XCTAssertEqual(donor.type, "other")
        XCTAssertEqual(donor.totalAmount, 1000.0)
        XCTAssertNil(donor.employer)
        XCTAssertNil(donor.state)
    }

    func testDecodeWithMissingOptionalCandidateFields() throws {
        let json: [String: Any] = [
            "candidateId": "P00000001",
            "name": "Candidate X",
            "party": "IND",
            "office": "President",
            "officeCode": "P",
            "state": "US",
            "totalRaised": 0.0,
            "totalFromPacs": 0.0,
            "totalFromIndividuals": 0.0,
            "donorCount": 0,
            "topDonors": [] as [[String: Any]],
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        let candidate = try JSONDecoder().decode(Candidate.self, from: data)

        XCTAssertNil(candidate.district)
        XCTAssertNil(candidate.incumbentChallenger)
        XCTAssertNil(candidate.committeeId)
        XCTAssertNil(candidate.lastUpdated)
    }

    func testComputedProperties() throws {
        let json: [String: Any] = [
            "candidateId": "H4NC01234",
            "name": "Test Person",
            "party": "DEM",
            "office": "US House NC-4",
            "officeCode": "H",
            "state": "NC",
            "incumbentChallenger": "I",
            "totalRaised": 100000.0,
            "totalFromPacs": 40000.0,
            "totalFromIndividuals": 60000.0,
            "donorCount": 100,
            "topDonors": [] as [[String: Any]],
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        let candidate = try JSONDecoder().decode(Candidate.self, from: data)

        XCTAssertEqual(candidate.partyDisplayName, "Democrat")
        XCTAssertEqual(candidate.partyAbbreviation, "D")
        XCTAssertEqual(candidate.statusLabel, "Incumbent")
        XCTAssertEqual(candidate.pacPercentage, 40.0, accuracy: 0.01)
        XCTAssertEqual(candidate.individualPercentage, 60.0, accuracy: 0.01)
    }
}
