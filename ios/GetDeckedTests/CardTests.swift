import XCTest
@testable import GetDecked

final class CardTests: XCTestCase {
    func testStressCardRequiresTarget() {
        let card = Card(id: "1", type: .stress, name: "Test", description: "", value: 2)
        XCTAssertTrue(card.requiresTarget)
        XCTAssertTrue(card.isStress)
        XCTAssertFalse(card.isSpecial)
    }

    func testChillDoesNotRequireTarget() {
        let card = Card(id: "2", type: .chill, name: "Test", description: "", value: 1)
        XCTAssertFalse(card.requiresTarget)
        XCTAssertTrue(card.isChill)
    }

    func testSnapRequiresFollowUp() {
        let card = Card(id: "3", type: .snap, name: "Test", description: "", value: 0)
        XCTAssertTrue(card.requiresFollowUp)
        XCTAssertTrue(card.isSpecial)
    }

    func testDeflectRequiresRedirectTarget() {
        let card = Card(id: "4", type: .deflect, name: "Test", description: "", value: 0)
        XCTAssertTrue(card.requiresRedirectTarget)
    }
}
