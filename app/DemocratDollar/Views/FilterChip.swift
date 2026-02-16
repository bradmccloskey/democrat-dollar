import SwiftUI

struct FilterChip: View {
    let label: String
    let isSelected: Bool
    var activeColor: Color = .accentColor

    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(isSelected ? activeColor.opacity(0.15) : Color.secondary.opacity(0.1))
                )
                .foregroundStyle(isSelected ? activeColor : .secondary)
                .overlay(
                    Capsule()
                        .strokeBorder(isSelected ? activeColor.opacity(0.4) : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
