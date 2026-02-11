import SwiftUI

enum PartisanBarSize {
    case small
    case large

    var height: CGFloat {
        switch self {
        case .small: return 8
        case .large: return 40
        }
    }

    var showPercentages: Bool {
        switch self {
        case .small: return false
        case .large: return true
        }
    }
}

struct PartisanBar: View {
    let democratPercent: Double
    let republicanPercent: Double
    let size: PartisanBarSize
    let animated: Bool

    @State private var animatedDemocratPercent: Double = 0

    init(democratPercent: Double, republicanPercent: Double, size: PartisanBarSize = .small, animated: Bool = true) {
        self.democratPercent = democratPercent
        self.republicanPercent = republicanPercent
        self.size = size
        self.animated = animated
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.red.opacity(0.8))
                    .frame(width: geometry.size.width, height: size.height)

                Rectangle()
                    .fill(Color.blue.opacity(0.8))
                    .frame(
                        width: geometry.size.width * (animated ? animatedDemocratPercent : democratPercent) / 100,
                        height: size.height
                    )

                if size.showPercentages {
                    HStack {
                        Text("\(Int(democratPercent))%")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .padding(.leading, 8)

                        Spacer()

                        Text("\(Int(republicanPercent))%")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .padding(.trailing, 8)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: size.height / 2))
        }
        .frame(height: size.height)
        .accessibilityLabel("Political donations: \(Int(democratPercent))% Democrat, \(Int(republicanPercent))% Republican")
        .onAppear {
            if animated {
                withAnimation(.easeInOut(duration: 0.8)) {
                    animatedDemocratPercent = democratPercent
                }
            }
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        PartisanBar(democratPercent: 72, republicanPercent: 28, size: .small)
            .frame(width: 100)

        PartisanBar(democratPercent: 72, republicanPercent: 28, size: .large)
            .padding()

        PartisanBar(democratPercent: 35, republicanPercent: 65, size: .large)
            .padding()

        PartisanBar(democratPercent: 50, republicanPercent: 50, size: .large)
            .padding()
    }
}
