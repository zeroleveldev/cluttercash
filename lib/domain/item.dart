enum Confidence { low, medium, high }

enum SaleEffort { low, medium, high }

enum ItemRoute { sell, bundle, donate, recycle, keep }

enum ItemStatus { unreviewed, sell, listed, sold, donated, recycled, keep }

enum Marketplace {
  ebay,
  facebookMarketplace,
  mercari,
  localPickup,
  consignment,
  donate,
}

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
    this.category = 'Home',
    this.reason = '',
    this.searchQuery = '',
    this.marketplace = Marketplace.localPickup,
    this.marketplaceReason = '',

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
  final String category;
  final String reason;
  final String searchQuery;
  final Marketplace marketplace;
  final String marketplaceReason;

  final double boxLeft;
  final double boxTop;
  final double boxWidth;
  final double boxHeight;

  ClutterItem copyWith({
    String? name,
    double? lowValue,
    double? typicalValue,
    double? highValue,
    Confidence? confidence,
    ItemStatus? status,
    String? searchQuery,
    Marketplace? marketplace,
    String? marketplaceReason,
  }) => ClutterItem(
    id: id,
    name: name ?? this.name,
    lowValue: lowValue ?? this.lowValue,
    typicalValue: typicalValue ?? this.typicalValue,
    highValue: highValue ?? this.highValue,
    confidence: confidence ?? this.confidence,
    effort: effort,
    route: route,
    status: status ?? this.status,
    category: category,
    reason: reason,
    searchQuery: searchQuery ?? this.searchQuery,
    marketplace: marketplace ?? this.marketplace,
    marketplaceReason: marketplaceReason ?? this.marketplaceReason,

    boxLeft: boxLeft,
    boxTop: boxTop,
    boxWidth: boxWidth,
    boxHeight: boxHeight,
  );
}
