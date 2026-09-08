import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/listing_questionnaire.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const item = ClutterItem(
    id: 'camera',
    name: 'Canon AE-1 35mm SLR Camera',
    lowValue: 80,
    typicalValue: 110,
    highValue: 150,
    confidence: Confidence.high,
    effort: SaleEffort.medium,
    route: ItemRoute.sell,
    listingDescription:
        'Canon AE-1 camera body. Confirm operation and included accessories.',
    missingDetails: ['Working condition', 'Included lens and accessories'],
  );

  test('adds only seller-confirmed facts without changing the estimate', () {
    final updated = ListingQuestionnaire.apply(item, {
      ListingQuestionnaire.workingCondition: 'Shutter fires and meter responds',
      ListingQuestionnaire.cosmeticWear: 'Small scuff near the rewind knob',
      ListingQuestionnaire.measurements: '',
      ListingQuestionnaire.includedItems: '50mm lens and strap',
    });

    expect(updated.typicalValue, item.typicalValue);
    expect(updated.listingDescription, contains('Seller-confirmed details:'));
    expect(
      updated.listingDescription,
      contains('Shutter fires and meter responds'),
    );
    expect(updated.listingDescription, contains('50mm lens and strap'));
    expect(updated.listingDescription, isNot(contains('Measurements:')));
    expect(
      updated.confirmedDetails[ListingQuestionnaire.cosmeticWear],
      'Small scuff near the rewind knob',
    );
  });

  test(
    'reopening replaces the confirmed section and resolves answered unknowns',
    () {
      final detailKey = ListingQuestionnaire.detailKey(
        'Included lens and accessories',
      );
      final first = ListingQuestionnaire.apply(item, {
        ListingQuestionnaire.workingCondition: 'Untested',
        detailKey: 'Body cap only',
      });
      final revised = ListingQuestionnaire.apply(first, {
        ListingQuestionnaire.workingCondition: 'Shutter fires',
        detailKey: '50mm lens and body cap',
      });

      expect(
        'Seller-confirmed details:'.allMatches(revised.listingDescription),
        hasLength(1),
      );
      expect(revised.listingDescription, isNot(contains('Untested')));
      expect(revised.listingDescription, contains('50mm lens and body cap'));
      expect(
        revised.missingDetails,
        isNot(contains('Included lens and accessories')),
      );
    },
  );
}
