import 'item.dart';

class ListingGuide {
  const ListingGuide({
    required this.title,
    required this.description,
    required this.searchQuery,
    required this.recommendedMarketplace,
    required this.marketplaceReason,
    required this.missingDetails,
    required this.ebayActive,
    required this.ebaySold,
    required this.facebookMarketplace,
    required this.mercari,
  });

  factory ListingGuide.forItem(ClutterItem item) {
    final query = item.searchQuery.trim().isNotEmpty
        ? item.searchQuery.trim()
        : item.name.trim();
    final marketplace =
        item.marketplace == Marketplace.localPickup &&
            item.marketplaceReason.trim().isEmpty
        ? _fallbackMarketplace(item)
        : item.marketplace;
    final missing = item.missingDetails.isNotEmpty
        ? item.missingDetails
        : const [
            'Brand and exact model',
            'Working condition',
            'Damage or wear',
            'Included accessories',
          ];

    return ListingGuide(
      title: item.listingTitle.trim().isNotEmpty
          ? item.listingTitle.trim()
          : '${item.name} — details to confirm',
      description: item.listingDescription.trim().isNotEmpty
          ? item.listingDescription.trim()
          : '${item.name}. Review the photos and confirm the exact model, condition, damage, and included accessories before posting.',
      searchQuery: query,
      recommendedMarketplace: marketplace,
      marketplaceReason: item.marketplaceReason.trim().isNotEmpty
          ? item.marketplaceReason.trim()
          : _fallbackReason(marketplace),
      missingDetails: List.unmodifiable(missing),
      ebayActive: Uri.https('www.ebay.com', '/sch/i.html', {'_nkw': query}),
      ebaySold: Uri.https('www.ebay.com', '/sch/i.html', {
        '_nkw': query,
        'LH_Complete': '1',
        'LH_Sold': '1',
      }),
      facebookMarketplace: Uri.https(
        'www.facebook.com',
        '/marketplace/search/',
        {'query': query},
      ),
      mercari: Uri.https('www.mercari.com', '/search/', {'keyword': query}),
    );
  }

  final String title;
  final String description;
  final String searchQuery;
  final Marketplace recommendedMarketplace;
  final String marketplaceReason;
  final List<String> missingDetails;
  final Uri ebayActive;
  final Uri ebaySold;
  final Uri facebookMarketplace;
  final Uri mercari;

  static const _evidenceDisclaimer =
      'Active listings show asking prices, not proven value. Completed-sale results are stronger evidence, but verify that the model, condition, accessories, and shipping terms truly match.';

  String get evidenceDisclaimer => _evidenceDisclaimer;
  String get copyText => '$title\n\n$description';

  static Marketplace _fallbackMarketplace(ClutterItem item) {
    if (item.route == ItemRoute.donate || item.typicalValue <= 10) {
      return Marketplace.donate;
    }
    final category = item.category.toLowerCase();
    if (item.typicalValue >= 500) return Marketplace.consignment;
    if (category.contains('camera') ||
        category.contains('audio') ||
        category.contains('electronic') ||
        category.contains('collect')) {
      return Marketplace.ebay;
    }
    if (category.contains('clothing') || category.contains('fashion')) {
      return Marketplace.mercari;
    }
    return Marketplace.facebookMarketplace;
  }

  static String _fallbackReason(
    Marketplace marketplace,
  ) => switch (marketplace) {
    Marketplace.ebay =>
      'eBay reaches a broad buyer pool and works well for searchable, shippable items.',
    Marketplace.facebookMarketplace =>
      'Facebook Marketplace is practical for quick local pickup and avoiding shipping.',
    Marketplace.mercari =>
      'Mercari is a simple option for smaller shippable consumer items.',
    Marketplace.localPickup =>
      'Use a local-pickup marketplace to reduce packing, fees, and shipping risk.',
    Marketplace.consignment =>
      'A specialist or consignment shop can help verify and market a higher-value item.',
    Marketplace.donate =>
      'Selling effort is likely to exceed the probable return; donation is the faster route.',
  };
}

extension MarketplaceLabel on Marketplace {
  String get label => switch (this) {
    Marketplace.ebay => 'eBay',
    Marketplace.facebookMarketplace => 'Facebook Marketplace',
    Marketplace.mercari => 'Mercari',
    Marketplace.localPickup => 'Local pickup',
    Marketplace.consignment => 'Specialist / consignment',
    Marketplace.donate => 'Donate',
  };
}
