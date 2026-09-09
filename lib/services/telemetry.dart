import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

enum TelemetryEvent {
  scanStarted('scan_started'),
  scanSucceeded('scan_succeeded'),
  scanFailed('scan_failed'),
  projectCreated('project_created'),
  projectReopened('project_reopened'),
  itemCorrected('item_corrected'),
  itemStatusUpdated('item_status_updated'),
  appCrash('app_crash');

  const TelemetryEvent(this.wireName);
  final String wireName;
}

enum TelemetryFailure {
  api('api'),
  network('network'),
  unknown('unknown'),
  framework('framework'),
  async('async');

  const TelemetryFailure(this.wireName);
  final String wireName;
}

abstract interface class TelemetryReporter {
  Future<void> record(TelemetryEvent event, {TelemetryFailure? failure});
}

void installTelemetryErrorHandlers(TelemetryReporter reporter) {
  final previousFlutterHandler = FlutterError.onError;
  FlutterError.onError = (details) {
    unawaited(
      reporter.record(
        TelemetryEvent.appCrash,
        failure: TelemetryFailure.framework,
      ),
    );
    previousFlutterHandler?.call(details);
  };

  final previousPlatformHandler = PlatformDispatcher.instance.onError;
  PlatformDispatcher.instance.onError = (error, stack) {
    unawaited(
      reporter.record(TelemetryEvent.appCrash, failure: TelemetryFailure.async),
    );
    return previousPlatformHandler?.call(error, stack) ?? false;
  };
}

class TelemetryScope extends InheritedWidget {
  const TelemetryScope({
    super.key,
    required this.reporter,
    required super.child,
  });

  final TelemetryReporter reporter;

  static TelemetryReporter of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<TelemetryScope>();
    assert(scope != null, 'No TelemetryScope found in context.');
    return scope!.reporter;
  }

  static TelemetryReporter read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<TelemetryScope>();
    assert(scope != null, 'No TelemetryScope found in context.');
    return scope!.reporter;
  }

  @override
  bool updateShouldNotify(TelemetryScope oldWidget) =>
      reporter != oldWidget.reporter;
}

class TelemetryClient implements TelemetryReporter {
  const TelemetryClient({
    required this.baseUrl,
    required this.inviteCode,
    this._client,
  });

  final String baseUrl;
  final String inviteCode;
  final http.Client? _client;

  bool get isConfigured =>
      baseUrl.trim().isNotEmpty && inviteCode.trim().isNotEmpty;

  @override
  Future<void> record(TelemetryEvent event, {TelemetryFailure? failure}) async {
    if (!isConfigured) return;
    final client = _client ?? http.Client();
    try {
      final body = <String, String>{'event': event.wireName};
      if (failure != null) body['failureCode'] = failure.wireName;
      await client
          .post(
            Uri.parse(
              '${baseUrl.trim().replaceAll(RegExp(r'/$'), '')}/v1/telemetry',
            ),
            headers: {
              'Content-Type': 'application/json',
              'X-ClutterCash-Invite': inviteCode.trim(),
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 5));
    } on Object {
      // Beta telemetry is best-effort and must never block the user journey.
    } finally {
      if (_client == null) client.close();
    }
  }
}
