import Foundation

extension Double {
    private static let currencyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    var formattedAsCurrency: String {
        Self.currencyFormatter.string(from: NSNumber(value: self)) ?? "$0"
    }
}

extension Date {
    private static let mediumDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    var formattedMedium: String {
        Self.mediumDateFormatter.string(from: self)
    }
}
