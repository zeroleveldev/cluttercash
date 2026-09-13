import 'dart:async';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:cluttercash/services/scan_api.dart';
import 'launch_integrity_test.dart' show lamp;

class StalledClient extends http.BaseClient {
  int sends = 0;
  bool closed = false;
  bool cancelled = false;
  late final body = StreamController<List<int>>(
    onCancel: () {
      cancelled = true;
    },
  );
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    sends++;
    await Future<void>.delayed(const Duration(seconds: 30));
    return http.StreamedResponse(body.stream, 200);
  }

  @override
  void close() {
    closed = true;
  }
}

void main() {
  for (final label in [false, true]) {
    testWidgets(
      'CC-11 complete deadline cancels stalled body label=$label without retry',
      (tester) async {
        final client = StalledClient();
        Object? failure;
        var completed = false;
        http.runWithClient(() {
          const api = ScanApi(
            baseUrl: 'https://example.invalid',
            inviteCode: 'test',
          );
          final bytes = Uint8List.fromList([255, 216, 255]);
          final future = label
              ? api.identifyFromLabel(bytes, lamp)
              : api.analyze(bytes);
          future.then(
            (_) {
              completed = true;
            },
            onError: (Object e) {
              completed = true;
              failure = e;
            },
          );
        }, () => client);
        await tester.pump();
        await tester.pump(const Duration(seconds: 30));
        await tester.pump(const Duration(seconds: 26));
        expect(completed, isTrue);
        expect(failure, isA<ScanApiException>());
        expect(client.closed, isTrue);
        expect(client.cancelled, isTrue);
        expect(client.sends, 1);
        await tester.pump(const Duration(seconds: 60));
        expect(client.sends, 1);
      },
    );
  }
}
