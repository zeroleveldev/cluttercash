import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/listing_guide.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const item = ClutterItem(
    id: 'camera',
    name: 'Vintage Nikon film camera',
    lowValue: 80,
    typicalValue: 120,
    highValue: 170,
    confidence: Confidence.medium,
    effort: SaleEffort.medium,
    route: ItemRoute.sell,
    category: 'Cameras',
    reason: 'Model label is not visible.',

    searchQuery: 'vintage Nikon film camera body',
    marketplace: Marketplace.ebay,
    marketplaceReason:
        'eBay reaches more camera buyers and supports shipped listings.',
  );

  test('builds separate active and completed-sale eBay searches', () {
    final guide = ListingGuide.forItem(item);

    expect(guide.ebayActive.host, 'www.ebay.com');
    expect(guide.ebayActive.queryParameters['_nkw'], item.searchQuery);
    expect(guide.ebayActive.queryParameters.containsKey('LH_Sold'), isFalse);
    expect(guide.ebaySold.queryParameters['LH_Sold'], '1');
    expect(guide.ebaySold.queryParameters['LH_Complete'], '1');
  });

  test('builds marketplace searches without claiming scraped prices', () {
    final guide = ListingGuide.forItem(item);

    expect(guide.facebookMarketplace.host, 'www.facebook.com');
    expect(
      guide.facebookMarketplace.queryParameters['query'],
      item.searchQuery,
    );
    expect(guide.mercari.host, 'www.mercari.com');
    expect(guide.mercari.queryParameters['keyword'], item.searchQuery);
    expect(guide.evidenceDisclaimer, contains('asking prices'));
    expect(guide.evidenceDisclaimer.toLowerCase(), contains('completed-sale'));
  });

  test('keeps the recommended marketplace for research links', () {
    expect(ListingGuide.forItem(item).recommendedMarketplace, Marketplace.ebay);
  });
}
