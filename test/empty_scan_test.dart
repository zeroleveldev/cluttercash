import 'dart:convert';
import 'package:cluttercash/main.dart';
import 'package:cluttercash/services/scan_api.dart';
import 'package:cluttercash/services/project_store.dart';
import 'package:cluttercash/services/telemetry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class Recorder implements TelemetryReporter {
  final events = <TelemetryEvent>[];
  @override
  Future<void> record(TelemetryEvent event, {TelemetryFailure? failure}) async {
    events.add(event);
  }
}

void main() {
  test(
    'CC-12 parser accepts valid empty results but rejects malformed shape',
    () {
      expect(
        ScanApi.parseResponse(
          '{"sceneSummary":"Empty shelf","items":[]}',
          projectId: 'p',
        ).items,
        isEmpty,
      );
      for (final body in [
        '{"items":[]}',
        '{"sceneSummary":"Shelf","items":null}',
        '{"sceneSummary":"Shelf","items":[{}]}',
      ]) {
        expect(
          () => ScanApi.parseResponse(body, projectId: 'p'),
          throwsFormatException,
        );
      }
    },
  );
  testWidgets(
    'CC-12 empty analysis is truthful success without demo or project save',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final recorder = Recorder();
      var calls = 0;
      final bytes = base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
      );
      await tester.pumpWidget(
        TelemetryScope(
          reporter: recorder,
          child: MaterialApp(
            home: AnalyzingScreen(
              imageBytes: bytes,
              analyze: (_) async {
                calls++;
                return ScanApi.parseResponse(
                  '{"sceneSummary":"Empty shelf","items":[]}',
                  projectId: 'p',
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('No items identified'), findsOneWidget);
      expect(find.textContaining('closer'), findsOneWidget);
      expect(find.byType(LiveAnalysisSetupScreen), findsNothing);
      expect(find.textContaining('DEMO'), findsNothing);
      expect(find.text('Vintage film camera'), findsNothing);
      expect(find.textContaining('Start clearing'), findsNothing);
      expect(recorder.events, contains(TelemetryEvent.scanSucceeded));
      expect(recorder.events, isNot(contains(TelemetryEvent.scanFailed)));
      expect(calls, 1);
      expect(
        await ProjectStore(await SharedPreferences.getInstance()).loadAll(),
        isEmpty,
      );
    },
  );
}
