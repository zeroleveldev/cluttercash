enum Confidence { low, medium, high }

enum SaleEffort { low, medium, high }

enum ItemRoute { sell, bundle, donate, recycle, keep }

enum ItemStatus { unreviewed, sell, listed, sold, donated, recycled, keep }

class ClutterItem {
  const ClutterItem({
    required this.id,
    required this.name,
    required this.lowValue,
    required this.typicalValue,
    required this.highValue,
    required this.confidence,
    required this.effort,
    required this.route,
    this.status = ItemStatus.unreviewed,
    this.soldPrice,
    this.fees = 0,
    this.category = 'Home',
    this.reason = '',
    this.boxLeft = .12,
    this.boxTop = .12,
    this.boxWidth = .3,
    this.boxHeight = .3,
  });

  final String id;
  final String name;
  final double lowValue;
  final double typicalValue;
  final double highValue;
  final Confidence confidence;
  final SaleEffort effort;
  final ItemRoute route;
  final ItemStatus status;
  final double? soldPrice;
  final double fees;
  final String category;
  final String reason;
  final double boxLeft;
  final double boxTop;
  final double boxWidth;
  final double boxHeight;

  double get expectedNet {
    final rate = switch (effort) {
      SaleEffort.low => .90,
      SaleEffort.medium => .85,
      SaleEffort.high => .75,
    };
    return typicalValue * rate;
  }

  ClutterItem copyWith({
    String? name,
    double? typicalValue,
    ItemStatus? status,
    double? soldPrice,
    double? fees,
  }) => ClutterItem(
    id: id,
    name: name ?? this.name,
    lowValue: lowValue,
    typicalValue: typicalValue ?? this.typicalValue,
    highValue: highValue,
    confidence: confidence,
    effort: effort,
    route: route,
    status: status ?? this.status,
    soldPrice: soldPrice ?? this.soldPrice,
    fees: fees ?? this.fees,
    category: category,
    reason: reason,
    boxLeft: boxLeft,
    boxTop: boxTop,
    boxWidth: boxWidth,
    boxHeight: boxHeight,
  );
}
