import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/project.dart';
import 'package:cluttercash/services/project_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'project store round-trips user decisions and realized earnings',
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
            ),
          )
          .recordSale('camera', soldPrice: 100, fees: 12);

      await store.save(original);
      final restored = await store.load('garage');

      expect(restored?.name, 'Garage Reset');
      expect(restored?.itemById('camera').status, ItemStatus.sold);
      expect(restored?.realizedEarnings, 88);
    },
  );

  test('project store returns null for an unknown project', () async {
    SharedPreferences.setMockInitialValues({});
    final store = ProjectStore(await SharedPreferences.getInstance());
    expect(await store.load('missing'), isNull);
  });
}
