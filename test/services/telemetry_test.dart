import 'dart:convert';

import 'package:cluttercash/services/telemetry.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets(
    'provides one reporter to every screen without user identifiers',
    (tester) async {
      final reporter = _RecordingTelemetry();
      late TelemetryReporter resolved;

      await tester.pumpWidget(
        TelemetryScope(
          reporter: reporter,
          child: MaterialApp(
            home: Builder(
              builder: (context) {
                resolved = TelemetryScope.of(context);
                return const SizedBox();
              },
            ),
          ),
        ),
      );

      expect(resolved, same(reporter));
    },
  );

  testWidgets('global error hooks report only coarse crash categories', (
    tester,
  ) async {
    final reporter = _RecordingTelemetry();
    final oldFlutterHandler = FlutterError.onError;
    final oldPlatformHandler = PlatformDispatcher.instance.onError;
    addTearDown(() {
      FlutterError.onError = oldFlutterHandler;
      PlatformDispatcher.instance.onError = oldPlatformHandler;
    });
    FlutterError.onError = (_) {};
    PlatformDispatcher.instance.onError = (_, _) => false;

    installTelemetryErrorHandlers(reporter);
    FlutterError.onError!(
      FlutterErrorDetails(exception: StateError('private framework detail')),
    );
    final handled = PlatformDispatcher.instance.onError!(
      StateError('private async detail'),
      StackTrace.current,
    );
    await tester.pump();

    expect(handled, isFalse);
    expect(reporter.events, [
      (TelemetryEvent.appCrash, TelemetryFailure.framework),
      (TelemetryEvent.appCrash, TelemetryFailure.async),
    ]);
  });

  test(
    'sends only a stable event and coarse failure code with beta access',
    () async {
      late http.Request captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response('{"accepted":true}', 202);
      });

      await TelemetryClient(
        baseUrl: 'https://api.example/',
        inviteCode: ' invite-123 ',
        client: client,
      ).record(TelemetryEvent.scanFailed, failure: TelemetryFailure.api);

      expect(captured.method, 'POST');
      expect(captured.url.toString(), 'https://api.example/v1/telemetry');
      expect(captured.headers['x-cluttercash-invite'], 'invite-123');
      expect(jsonDecode(captured.body), {
        'event': 'scan_failed',
        'failureCode': 'api',
      });
    },
  );

  test('sends no identifiers or metadata with funnel events', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return http.Response('{"accepted":true}', 202);
    });

    await TelemetryClient(
      baseUrl: 'https://api.example',
      inviteCode: 'invite-123',
      client: client,
    ).record(TelemetryEvent.itemCorrected);

    expect(jsonDecode(captured.body), {'event': 'item_corrected'});
  });

  test('is best-effort when unconfigured or when delivery fails', () async {
    var sends = 0;
    final client = MockClient((request) async {
      sends += 1;
      throw http.ClientException('private transport details');
    });

    await TelemetryClient(
      baseUrl: '',
      inviteCode: '',
      client: client,
    ).record(TelemetryEvent.projectCreated);
    await TelemetryClient(
      baseUrl: 'https://api.example',
      inviteCode: 'invite-123',
      client: client,
    ).record(TelemetryEvent.projectCreated);

    expect(sends, 1);
  });
}

class _RecordingTelemetry implements TelemetryReporter {
  final events = <(TelemetryEvent, TelemetryFailure?)>[];

  @override
  Future<void> record(TelemetryEvent event, {TelemetryFailure? failure}) async {
    events.add((event, failure));
  }
}
