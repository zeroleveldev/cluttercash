import 'dart:convert';

import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/project.dart';
import 'package:cluttercash/domain/scan_result.dart';
import 'package:cluttercash/main.dart';
import 'package:cluttercash/services/project_store.dart';
import 'package:cluttercash/services/scan_api.dart';
import 'package:cluttercash/services/telemetry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _NoTelemetry implements TelemetryReporter {
  @override
  Future<void> record(
    TelemetryEvent event, {
    TelemetryFailure? failure,
  }) async {}
}

Map<String, dynamic> _rawItem({
  String? priceSource,
  Object? ebayComparableCount,
}) => {
  'id': 'camera',
  'name': 'Film camera',
  'lowValue': 80,
  'typicalValue': 110,
  'highValue': 150,
  'priceSource': ?priceSource,
  'ebayComparableCount': ?ebayComparableCount,
};

String _scanBody(Map<String, dynamic> item) => jsonEncode({
  'sceneSummary': 'Shelf',
  'items': [item],
});

const _ebayItem = ClutterItem(
  id: 'camera',
  name: 'Film camera',
  lowValue: 80,
  typicalValue: 110,
  highValue: 150,
  priceSource: PriceSource.ebayActive,
  ebayComparableCount: 7,
  confidence: Confidence.medium,
  effort: SaleEffort.medium,
  route: ItemRoute.sell,
  marketplace: Marketplace.ebay,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('scan price provenance', () {
    test('parses eBay aggregate evidence', () {
      final item = ScanApi.parseResponse(
        _scanBody(_rawItem(priceSource: 'ebay_active', ebayComparableCount: 7)),
        projectId: 'p',
      ).items.single;

      expect(item.priceSource, PriceSource.ebayActive);
      expect(item.ebayComparableCount, 7);
    });

    test('absent rollout fields fall back to AI provenance', () {
      final item = ScanApi.parseResponse(
        _scanBody(_rawItem()),
        projectId: 'p',
      ).items.single;

      expect(item.priceSource, PriceSource.aiEstimate);
      expect(item.ebayComparableCount, 0);
    });

    test('rejects unknown sources and invalid eBay evidence', () {
      for (final raw in [
        _rawItem(priceSource: 'sold_results', ebayComparableCount: 7),
        _rawItem(priceSource: 'ebay_active', ebayComparableCount: 2),
        _rawItem(priceSource: 'ebay_active', ebayComparableCount: 3.5),
        {
          ..._rawItem(priceSource: 'ebay_active', ebayComparableCount: 7),
          'typicalValue': 70,
        },
      ]) {
        expect(
          () => ScanApi.parseResponse(_scanBody(raw), projectId: 'p'),
          throwsFormatException,
        );
      }
    });
  });

  test('label evidence can replace range and provenance', () {
    final result = ScanApi.parseIdentificationResponse(
      jsonEncode({
        'exactName': 'Canon AE-1 camera',
        'lowValue': 95,
        'typicalValue': 125,
        'highValue': 165,
        'priceSource': 'ebay_active',
        'ebayComparableCount': 9,
      }),
      _ebayItem.copyWith(
        priceSource: PriceSource.aiEstimate,
        ebayComparableCount: 0,
      ),
    );

    expect(result.item.name, 'Canon AE-1 camera');
    expect(
      [result.item.lowValue, result.item.typicalValue, result.item.highValue],
      [95, 125, 165],
    );
    expect(result.item.priceSource, PriceSource.ebayActive);
    expect(result.item.ebayComparableCount, 9);
  });

  test('manual identity or value edits invalidate eBay provenance', () {
    expect(
      _ebayItem.copyWith(name: 'Corrected camera').priceSource,
      PriceSource.userEntered,
    );
    expect(_ebayItem.copyWith(lowValue: 75).ebayComparableCount, 0);
    final statusOnly = _ebayItem.copyWith(status: ItemStatus.listed);
    expect(statusOnly.priceSource, PriceSource.ebayActive);
    expect(statusOnly.ebayComparableCount, 7);
  });

  test('persistence round-trips only aggregate eBay provenance', () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final store = ProjectStore(preferences);
    await store.save(
      CleanoutProject(
        id: 'p',
        name: 'Project',
        items: const [_ebayItem],
        createdAt: DateTime(2026),
      ),
    );

    final restored = (await store.load('p'))!.items.single;
    final encoded = preferences.getString('cluttercash.project.p')!;
    expect(restored.priceSource, PriceSource.ebayActive);
    expect(restored.ebayComparableCount, 7);
    expect(encoded, contains('"priceSource":"ebay_active"'));
    expect(encoded, contains('"ebayComparableCount":7'));
    expect(encoded, isNot(contains('comparableListings')));
    expect(encoded, isNot(contains('itemWebUrl')));
  });

  testWidgets('eBay range is labeled as time-bound active asking evidence', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      TelemetryScope(
        reporter: _NoTelemetry(),
        child: MaterialApp(
          home: ResultsScreen(
            result: ScanResult(
              id: 's',
              projectId: 'p',
              createdAt: DateTime(2026),
              items: const [_ebayItem],
            ),
          ),
        ),
      ),
    );
    await tester.tap(
      find
          .ancestor(
            of: find.text('Film camera'),
            matching: find.byType(InkWell),
          )
          .first,
    );
    await tester.pumpAndSettle();

    expect(
      find.text(r'$80–$150 · eBay active asking-price range'),
      findsOneWidget,
    );
    expect(
      find.text(
        'Based on 7 filtered active listings captured at analysis time. These are current active asking prices—not sold prices, not an appraisal, and not a guaranteed sale price.',
      ),
      findsOneWidget,
    );
  });
}
