import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/project.dart';
import 'package:cluttercash/services/project_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'project store round-trips item status without transaction data',
    () async {
      SharedPreferences.setMockInitialValues({});
      final store = ProjectStore(await SharedPreferences.getInstance());
      final original = CleanoutProject.empty(id: 'garage', name: 'Garage Reset')
          .addItem(
            const ClutterItem(
              id: 'camera',
              name: 'Film camera',
              lowValue: 80,
              typicalValue: 110,
              highValue: 150,
              confidence: Confidence.medium,
              effort: SaleEffort.medium,
              route: ItemRoute.sell,
              searchQuery: 'film camera body',
              marketplace: Marketplace.ebay,
              marketplaceReason: 'Broad camera buyer pool.',
            ),
          )
          .updateStatus('camera', ItemStatus.sold);

      await store.save(original);
      final restored = await store.load('garage');

      expect(restored?.name, 'Garage Reset');
      expect(restored?.itemById('camera').status, ItemStatus.sold);
      expect(
        await SharedPreferences.getInstance().then(
          (preferences) => preferences.getString('cluttercash.project.garage'),
        ),
        isNot(contains('soldPrice')),
      );
      expect(
        await SharedPreferences.getInstance().then(
          (preferences) => preferences.getString('cluttercash.project.garage'),
        ),
        isNot(contains('fees')),
      );
      final encoded = await SharedPreferences.getInstance().then(
        (preferences) => preferences.getString('cluttercash.project.garage'),
      );
      expect(encoded, isNot(contains('listingTitle')));
      expect(encoded, isNot(contains('listingDescription')));
      expect(encoded, isNot(contains('missingDetails')));
      expect(encoded, isNot(contains('confirmedDetails')));
      expect(restored?.itemById('camera').marketplace, Marketplace.ebay);
    },
  );

  test('project store returns null for an unknown project', () async {
    SharedPreferences.setMockInitialValues({});
    final store = ProjectStore(await SharedPreferences.getInstance());
    expect(await store.load('missing'), isNull);
  });
}
