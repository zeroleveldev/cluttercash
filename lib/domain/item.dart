enum Confidence { low, medium, high }

enum SaleEffort { low, medium, high }

enum ItemRoute { sell, bundle, donate, recycle, keep }

enum ItemStatus { unreviewed, sell, listed, sold, donated, recycled, keep }

enum PriceSource { aiEstimate, ebayActive, userEntered }

String priceSourceWireName(PriceSource source) => switch (source) {
  PriceSource.aiEstimate => 'ai_estimate',
  PriceSource.ebayActive => 'ebay_active',
  PriceSource.userEntered => 'user_entered',
};

PriceSource parsePriceSource(dynamic value, {bool allowAbsent = true}) {
  if (value == null && allowAbsent) return PriceSource.aiEstimate;
  return switch (value) {
    'ai_estimate' => PriceSource.aiEstimate,
    'ebay_active' => PriceSource.ebayActive,
    'user_entered' => PriceSource.userEntered,
    _ => throw const FormatException('Invalid price source.'),
  };
}

void validatePriceProvenance(PriceSource source, int comparableCount) {
  if (source == PriceSource.ebayActive) {
    if (comparableCount < 3) {
      throw const FormatException(
        'An eBay active range requires at least three comparables.',
      );
    }
  } else if (comparableCount != 0) {
    throw const FormatException(
      'Only an eBay active range can have eBay comparables.',
    );
  }
}

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
    this.priceSource = PriceSource.aiEstimate,
    this.ebayComparableCount = 0,
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
  final PriceSource priceSource;
  final int ebayComparableCount;
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
    PriceSource? priceSource,
    int? ebayComparableCount,
    String? searchQuery,
    Marketplace? marketplace,
    String? marketplaceReason,
  }) {
    final manuallyCorrected =
        name != null ||
        lowValue != null ||
        typicalValue != null ||
        highValue != null;
    final nextPriceSource =
        priceSource ??
        (manuallyCorrected ? PriceSource.userEntered : this.priceSource);
    final nextComparableCount =
        ebayComparableCount ??
        (manuallyCorrected || nextPriceSource != PriceSource.ebayActive
            ? 0
            : this.ebayComparableCount);
    return ClutterItem(
      id: id,
      name: name ?? this.name,
      lowValue: lowValue ?? this.lowValue,
      typicalValue: typicalValue ?? this.typicalValue,
      highValue: highValue ?? this.highValue,
      confidence: confidence ?? this.confidence,
      effort: effort,
      route: route,
      status: status ?? this.status,
      priceSource: nextPriceSource,
      ebayComparableCount: nextComparableCount,
      category: category,
      reason: reason,
      searchQuery:
          searchQuery ??
          (name != null && name != this.name ? name : this.searchQuery),
      marketplace:
          marketplace ??
          (name != null && name != this.name
              ? Marketplace.localPickup
              : this.marketplace),
      marketplaceReason:
          marketplaceReason ??
          (name != null && name != this.name
              ? 'Identity corrected. Compare marketplaces and verify suitability before selling.'
              : this.marketplaceReason),

      boxLeft: boxLeft,
      boxTop: boxTop,
      boxWidth: boxWidth,
      boxHeight: boxHeight,
    );
  }
}
