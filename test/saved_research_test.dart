import 'dart:convert';
import 'package:cluttercash/main.dart';
import 'package:cluttercash/domain/scan_result.dart';
import 'package:cluttercash/services/project_store.dart';
import 'package:cluttercash/services/telemetry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/link.dart';
import 'launch_integrity_test.dart' show lamp, NoTelemetry;

Widget app(Widget home) => TelemetryScope(
  reporter: NoTelemetry(),
  child: MaterialApp(home: home),
);
void main() {
  for (final demo in [true, false]) {
    testWidgets(
      'CC-06/07 ${demo ? 'demo' : 'live'} save library reopen correct research persists',
      (tester) async {
        tester.view.physicalSize = const Size(800, 1200);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        SharedPreferences.setMockInitialValues({});
        final prefs = await SharedPreferences.getInstance();
        final store = ProjectStore(prefs);
        await tester.pumpWidget(
          app(
            ResultsScreen(
              result: demo
                  ? null
                  : ScanResult(
                      id: 'scan',
                      projectId: 'p',
                      createdAt: DateTime(2026),
                      items: const [lamp],
                    ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final save = find.text(
          demo ? 'Start clearing 3 items' : 'Start clearing 1 items',
        );
        await tester.ensureVisible(save);
        await tester.tap(save);
        await tester.pumpAndSettle();
        expect(find.byType(ProjectBoardScreen), findsOneWidget);
        if (demo) {
          expect(
            find.text('DEMO · Sample items and estimates'),
            findsOneWidget,
          );
        }
        final saved = (await store.loadAll()).single;
        expect(
          jsonDecode(
            prefs.getString('cluttercash.project.${saved.id}')!,
          )['isDemo'],
          demo,
        );
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpWidget(app(ProjectLibraryScreen(store: store)));
        await tester.pumpAndSettle();
        if (demo) expect(find.textContaining('DEMO'), findsOneWidget);
        await tester.tap(find.text('Garage Reset'));
        await tester.pumpAndSettle();
        if (demo) {
          expect(
            find.text('DEMO · Sample items and estimates'),
            findsOneWidget,
          );
        }
        final detail = find.text('Research / correct item').first;
        expect(detail, findsOneWidget);
        await tester.ensureVisible(detail);
        await tester.tap(detail);
        await tester.pumpAndSettle();
        if (demo) {
          expect(
            find.text('DEMO · Sample items and estimates'),
            findsNWidgets(2),
          );
        }
        await tester.ensureVisible(find.text('I need to correct this item'));
        await tester.tap(find.text('I need to correct this item'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField).at(0), 'Verified drill');
        await tester.enterText(find.byType(TextField).at(1), '30');
        await tester.enterText(find.byType(TextField).at(2), '40');
        await tester.enterText(find.byType(TextField).at(3), '50');
        await tester.ensureVisible(find.text('Save correction'));
        await tester.tap(find.text('Save correction'));
        await tester.pumpAndSettle();
        void verifyLinks() {
          final links = tester
              .widgetList<Link>(find.byType(Link))
              .where((l) => l.uri?.host == 'www.ebay.com')
              .toList();
          expect(links.length, 2);
          for (final link in links) {
            expect(link.uri!.queryParameters['_nkw'], 'Verified drill');
            expect(link.target, LinkTarget.blank);
          }
        }

        verifyLinks();
        final readback = (await store.load(saved.id))!;
        final corrected = readback.items.first;
        expect(corrected.name, 'Verified drill');
        expect(
          [corrected.lowValue, corrected.typicalValue, corrected.highValue],
          [30, 40, 50],
        );
        expect(corrected.status, saved.items.first.status);
        expect(
          readback.items.skip(1).map((i) => i.name),
          saved.items.skip(1).map((i) => i.name),
        );
        expect(
          jsonDecode(
            prefs.getString('cluttercash.project.${saved.id}')!,
          )['isDemo'],
          demo,
        );
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpWidget(app(ProjectLibraryScreen(store: store)));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Garage Reset'));
        await tester.pumpAndSettle();
        expect(find.text('Verified drill'), findsOneWidget);
        await tester.ensureVisible(find.text('Research / correct item').first);
        await tester.tap(find.text('Research / correct item').first);
        await tester.pumpAndSettle();
        verifyLinks();
        expect(tester.takeException(), isNull);
      },
    );
  }
}
