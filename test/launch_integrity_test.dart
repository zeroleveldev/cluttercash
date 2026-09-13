import 'dart:convert';
import 'package:url_launcher/link.dart';
import 'package:cluttercash/services/telemetry.dart';

import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/project.dart';
import 'package:cluttercash/domain/scan_result.dart';
import 'package:cluttercash/services/project_store.dart';
import 'package:cluttercash/services/scan_api.dart';
import 'package:cluttercash/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NoTelemetry implements TelemetryReporter {
  @override
  Future<void> record(
    TelemetryEvent event, {
    TelemetryFailure? failure,
  }) async {}
}

const lamp = ClutterItem(
  id: 'lamp',
  name: 'Lamp',
  lowValue: 10,
  typicalValue: 15,
  highValue: 20,
  confidence: Confidence.medium,
  effort: SaleEffort.low,
  route: ItemRoute.sell,
  searchQuery: 'old lamp search',
);
Map<String, dynamic> rawItem(num value) => {
  'id': 'lamp',
  'name': 'Lamp',
  'lowValue': value,
  'typicalValue': value,
  'highValue': value,
};
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'CC-04 identity change resets stale research but price-only does not',
    () {
      final original = lamp.copyWith(
        marketplace: Marketplace.ebay,
        marketplaceReason: 'Old lamp rationale',
      );
      final corrected = original.copyWith(name: 'Verified drill');
      expect(corrected.searchQuery, 'Verified drill');
      expect(corrected.marketplaceReason, isNot(contains('Old lamp')));
      expect(
        original.copyWith(typicalValue: 16).searchQuery,
        'old lamp search',
      );
      final label = ScanApi.parseIdentificationResponse(
        '{"exactName":"Verified drill"}',
        original,
      );
      expect(label.item.searchQuery, 'Verified drill');
      expect(label.item.marketplaceReason, isNot(contains('Old lamp')));
    },
  );
  testWidgets('CC-04 correction updates actual research link URI', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      TelemetryScope(
        reporter: NoTelemetry(),
        child: MaterialApp(
          home: ResultsScreen(
            result: ScanResult(
              id: 's',
              projectId: 'p',
              createdAt: DateTime(2026),
              items: const [lamp],
            ),
          ),
        ),
      ),
    );
    await tester.tap(
      find
          .ancestor(of: find.text('Lamp'), matching: find.byType(InkWell))
          .first,
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('I need to correct this item'));
    await tester.tap(find.text('I need to correct this item'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Verified drill');
    await tester.ensureVisible(find.text('Save correction'));
    await tester.tap(find.text('Save correction'));
    await tester.pumpAndSettle();
    final links = tester
        .widgetList<Link>(find.byType(Link))
        .where((link) => link.uri?.host == 'www.ebay.com');
    expect(links, isNotEmpty);
    for (final link in links) {
      expect(link.uri!.queryParameters['_nkw'], 'Verified drill');
    }
    expect(tester.takeException(), isNull);
  });
  for (final ids in [
    ['same', 'same'],
    ['item-2', null],
    ['x' * 129, 'ok'],
    ['', 'ok'],
  ]) {
    test('CC-05 API rejects invalid or colliding IDs $ids', () {
      expect(
        () => ScanApi.parseResponse(
          jsonEncode({
            'sceneSummary': 'Shelf',
            'items': [
              for (final id in ids) {...rawItem(10), 'id': id},
            ],
          }),
          projectId: 'p',
        ),
        throwsFormatException,
      );
    });
  }
  test(
    'CC-05 persistence rejects duplicate IDs before overwrite and on load',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final store = ProjectStore(prefs);
      final valid = CleanoutProject(
        id: 'p',
        name: 'Project',
        createdAt: DateTime(2026),
        items: const [lamp],
      );
      await store.save(valid);
      final before = prefs.getString('cluttercash.project.p');
      await expectLater(
        store.save(
          CleanoutProject(
            id: 'p',
            name: 'Project',
            createdAt: DateTime(2026),
            items: [
              lamp,
              lamp.copyWith(name: 'Camera'),
            ],
          ),
        ),
        throwsFormatException,
      );
      expect(prefs.getString('cluttercash.project.p'), before);
      await prefs.setString(
        'cluttercash.project.p',
        jsonEncode({
          'id': 'p',
          'name': 'Project',
          'items': [rawItem(10), rawItem(10)],
        }),
      );
      expect(await store.load('p'), isNull);
      expect(prefs.getString('cluttercash.project.p'), isNotNull);
    },
  );
  test(
    'CC-05 distinct objects remain isolated after save and reload',
    () async {
      final scan = ScanApi.parseResponse(
        jsonEncode({
          'sceneSummary': 'Shelf',
          'items': [
            {...rawItem(10), 'id': 'one'},
            {...rawItem(10), 'id': 'two'},
          ],
        }),
        projectId: 'p',
      );
      SharedPreferences.setMockInitialValues({});
      final store = ProjectStore(await SharedPreferences.getInstance());
      await store.save(
        CleanoutProject(
          id: 'p',
          name: 'Project',
          createdAt: DateTime(2026),
          items: scan.items,
        ),
      );
      final project = (await store.load(
        'p',
      ))!.updateStatus('one', ItemStatus.sold);
      expect(project.clearedCount, 1);
      expect(project.itemById('two').status, ItemStatus.unreviewed);
    },
  );

  for (final value in [1e308, 1000001, -1]) {
    test('API rejects unsupported price $value', () {
      expect(
        () => ScanApi.parseResponse(
          jsonEncode({
            'sceneSummary': 'Shelf',
            'items': [rawItem(value)],
          }),
          projectId: 'p',
        ),
        throwsFormatException,
      );
    });
    test(
      'persistence rejects unsupported price $value on save and load',
      () async {
        SharedPreferences.setMockInitialValues({});
        final prefs = await SharedPreferences.getInstance();
        final store = ProjectStore(prefs);
        final project = CleanoutProject(
          id: 'p',
          name: 'Project',
          createdAt: DateTime(2026),
          items: [
            lamp.copyWith(
              lowValue: value.toDouble(),
              typicalValue: value.toDouble(),
              highValue: value.toDouble(),
            ),
          ],
        );
        await expectLater(store.save(project), throwsFormatException);
        expect(prefs.getString('cluttercash.project.p'), isNull);
        await prefs.setString(
          'cluttercash.project.p',
          jsonEncode({
            'id': 'p',
            'name': 'Project',
            'items': [rawItem(value)],
          }),
        );
        expect(await store.load('p'), isNull);
      },
    );
  }
  test('API rejects overflow exponent and unordered ranges', () {
    for (final body in [
      '{"sceneSummary":"Shelf","items":[{"name":"Lamp","lowValue":1e999,"typicalValue":1e999,"highValue":1e999}]}',
      jsonEncode({
        'sceneSummary': 'Shelf',
        'items': [
          {'name': 'Lamp', 'lowValue': 20, 'typicalValue': 10, 'highValue': 30},
        ],
      }),
    ]) {
      expect(
        () => ScanApi.parseResponse(body, projectId: 'p'),
        throwsFormatException,
      );
    }
  });
  test('totals reject corrupt numbers instead of producing infinity', () {
    final scan = ScanResult(
      id: 's',
      projectId: 'p',
      createdAt: DateTime(2026),
      items: [lamp.copyWith(lowValue: 1e308), lamp.copyWith(lowValue: 1e308)],
    );
    expect(() => scan.lowTotal, throwsFormatException);
  });
  test('maximum supported price remains usable and persistable', () async {
    final scan = ScanApi.parseResponse(
      jsonEncode({
        'sceneSummary': 'Shelf',
        'items': [rawItem(1000000)],
      }),
      projectId: 'p',
    );
    expect(scan.highTotal, 1000000);
    SharedPreferences.setMockInitialValues({});
    final store = ProjectStore(await SharedPreferences.getInstance());
    await store.save(
      CleanoutProject(
        id: 'p',
        name: 'Project',
        createdAt: DateTime(2026),
        items: scan.items,
      ),
    );
    expect((await store.load('p'))!.items.single.highValue, 1000000);
  });
  for (final value in ['NaN', 'Infinity', '1e308', '1000001']) {
    testWidgets('correction rejects $value without leaving form or crashing', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final result = ScanResult(
        id: 's',
        projectId: 'p',
        createdAt: DateTime(2026),
        items: const [lamp],
      );
      await tester.pumpWidget(
        TelemetryScope(
          reporter: NoTelemetry(),
          child: MaterialApp(home: ResultsScreen(result: result)),
        ),
      );
      await tester.tap(
        find
            .ancestor(of: find.text('Lamp'), matching: find.byType(InkWell))
            .first,
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('I need to correct this item'));
      await tester.tap(find.text('I need to correct this item'));
      await tester.pumpAndSettle();
      for (final label in [
        'Low potential value',
        'Typical potential value',
        'High potential value',
      ]) {
        await tester.enterText(find.widgetWithText(TextField, label), value);
      }
      await tester.ensureVisible(find.text('Save correction'));
      await tester.tap(find.text('Save correction'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Correct this item'), findsOneWidget);
    });
  }
}
