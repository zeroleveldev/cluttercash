import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/project.dart';
import 'package:cluttercash/main.dart';
import 'package:cluttercash/services/project_store.dart';
import 'package:cluttercash/services/telemetry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _RecordingTelemetry implements TelemetryReporter {
  final events = <TelemetryEvent>[];

  @override
  Future<void> record(TelemetryEvent event, {TelemetryFailure? failure}) async {
    events.add(event);
  }
}

CleanoutProject _project(String id, String name) =>
    CleanoutProject.empty(id: id, name: name).addItem(
      const ClutterItem(
        id: 'camera',
        name: 'Film camera',
        lowValue: 80,
        typicalValue: 110,
        highValue: 150,
        confidence: Confidence.medium,
        effort: SaleEffort.medium,
        route: ItemRoute.sell,
        status: ItemStatus.sell,
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('reopens a saved project from the project library', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final store = ProjectStore(await SharedPreferences.getInstance());
    await store.save(_project('kitchen', 'Kitchen shelf'));
    final telemetry = _RecordingTelemetry();

    await tester.pumpWidget(
      TelemetryScope(
        reporter: telemetry,
        child: MaterialApp(home: ProjectLibraryScreen(store: store)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Your projects'), findsOneWidget);
    expect(find.text('Kitchen shelf'), findsOneWidget);
    expect(find.text('1 item · 0 cleared'), findsOneWidget);

    await tester.tap(find.text('Kitchen shelf'));
    await tester.pumpAndSettle();

    expect(find.text('Kitchen shelf'), findsOneWidget);
    expect(find.text('0 items cleared'), findsOneWidget);
    expect(telemetry.events, [TelemetryEvent.projectReopened]);
  });

  testWidgets('deletes one saved project after confirmation', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final store = ProjectStore(await SharedPreferences.getInstance());
    await store.save(_project('garage', 'Garage shelf'));

    await tester.pumpWidget(
      MaterialApp(home: ProjectLibraryScreen(store: store)),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Delete Garage shelf'));
    await tester.pumpAndSettle();
    expect(find.text('Delete project?'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Delete project'));
    await tester.pumpAndSettle();

    expect(find.text('No saved projects yet'), findsOneWidget);
    expect(await store.load('garage'), isNull);
  });

  testWidgets('deletes all saved projects after confirmation', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final store = ProjectStore(await SharedPreferences.getInstance());
    await store.save(_project('garage', 'Garage shelf'));
    await store.save(_project('closet', 'Hall closet'));

    await tester.pumpWidget(
      MaterialApp(home: ProjectLibraryScreen(store: store)),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Delete all projects'));
    await tester.pumpAndSettle();
    expect(find.text('Delete all saved projects?'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Delete all'));
    await tester.pumpAndSettle();

    expect(find.text('No saved projects yet'), findsOneWidget);
    expect(await store.loadAll(), isEmpty);
  });
}
