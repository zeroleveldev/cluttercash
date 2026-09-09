import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/scan_result.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('scan totals ranges and highlights genuinely valuable items', () {
    final scan = ScanResult(
      id: 'scan-1',
      projectId: 'garage',
      createdAt: DateTime(2026, 9, 7),
      items: const [
        ClutterItem(
          id: 'camera',
          name: 'Vintage camera',
          lowValue: 140,
          typicalValue: 190,
          highValue: 260,
          confidence: Confidence.high,
          effort: SaleEffort.medium,
          route: ItemRoute.sell,
        ),
        ClutterItem(
          id: 'lamp',
          name: 'Desk lamp',
          lowValue: 12,
          typicalValue: 20,
          highValue: 28,
          confidence: Confidence.medium,
          effort: SaleEffort.low,
          route: ItemRoute.bundle,
        ),
      ],
    );

    expect(scan.lowTotal, 152);
    expect(scan.typicalTotal, 210);
    expect(scan.highTotal, 288);
    expect(scan.bigTicketItems().single.name, 'Vintage camera');
  });

  test('big ticket threshold is configurable and inclusive', () {
    final scan = ScanResult(
      id: 'scan-1',
      projectId: 'garage',
      createdAt: DateTime(2026, 9, 7),
      items: const [
        ClutterItem(
          id: 'console',
          name: 'Game console',
          lowValue: 80,
          typicalValue: 100,
          highValue: 130,
          confidence: Confidence.medium,
          effort: SaleEffort.low,
          route: ItemRoute.sell,
        ),
      ],
    );

    expect(scan.bigTicketItems(threshold: 100), hasLength(1));
    expect(scan.bigTicketItems(threshold: 101), isEmpty);
  });
}
