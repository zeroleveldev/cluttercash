import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/project.dart';
import 'package:cluttercash/main.dart';
import 'package:cluttercash/services/telemetry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _RecordingTelemetry implements TelemetryReporter {
  final events = <TelemetryEvent>[];

  @override
  Future<void> record(TelemetryEvent event, {TelemetryFailure? failure}) async {
    events.add(event);
  }
}

void main() {
  testWidgets('Sold marks an item cleared without recording earnings', (
    tester,
  ) async {
    final project = CleanoutProject.empty(id: 'garage', name: 'Garage Reset')
        .addItem(
          const ClutterItem(
            id: 'camera',
            name: 'Film camera',
            lowValue: 140,
            typicalValue: 190,
            highValue: 260,
            confidence: Confidence.high,
            effort: SaleEffort.medium,
            route: ItemRoute.sell,
            status: ItemStatus.sell,
          ),
        );

    final telemetry = _RecordingTelemetry();
    await tester.pumpWidget(
      TelemetryScope(
        reporter: telemetry,
        child: MaterialApp(home: ProjectBoardScreen(project: project)),
      ),
    );
    expect(find.text('Garage Reset'), findsOneWidget);
    expect(find.textContaining('earned'), findsNothing);

    final estimateDisclaimer = find.textContaining(
      'Potential values are estimates',
    );
    await tester.scrollUntilVisible(
      estimateDisclaimer,
      200,
      scrollable: find.byType(Scrollable).last,
    );
    expect(estimateDisclaimer, findsOneWidget);

    await tester.tap(find.text('Sold'));
    await tester.pumpAndSettle();

    expect(find.text('1 of 1 cleared'), findsOneWidget);
    expect(find.textContaining('earned'), findsNothing);
    expect(telemetry.events, [TelemetryEvent.itemStatusUpdated]);
  });
}
