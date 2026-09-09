import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/project.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('project board tracks item status and cleared progress', () {
    var project = CleanoutProject.empty(id: 'garage', name: 'Garage Reset')
        .addItem(
          const ClutterItem(
            id: 'camera',
            name: 'Vintage camera',
            lowValue: 140,
            typicalValue: 190,
            highValue: 260,
            confidence: Confidence.high,
            effort: SaleEffort.medium,
            route: ItemRoute.sell,
          ),
        )
        .updateStatus('camera', ItemStatus.sold);

    expect(project.itemById('camera').status, ItemStatus.sold);
    expect(project.clearedCount, 1);
    expect(project.progress, 1);
  });

  test('manual identity and price corrections preserve user control', () {
    final project = CleanoutProject.empty(id: 'garage', name: 'Garage Reset')
        .addItem(
          const ClutterItem(
            id: 'unknown',
            name: 'Old speaker',
            lowValue: 20,
            typicalValue: 30,
            highValue: 45,
            confidence: Confidence.low,
            effort: SaleEffort.medium,
            route: ItemRoute.sell,
          ),
        )
        .correctItem('unknown', name: 'Bose SoundLink Mini', typicalValue: 65);

    expect(project.itemById('unknown').name, 'Bose SoundLink Mini');
    expect(project.itemById('unknown').typicalValue, 65);
  });
}
