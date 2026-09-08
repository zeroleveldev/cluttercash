import 'dart:convert';
import 'dart:typed_data';

import 'package:cluttercash/services/scan_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('parses the server scan contract into domain values', () {
    final scan = ScanApi.parseResponse(
      jsonEncode({
        'sceneSummary': 'Garage shelf',
        'items': [
          {
            'id': 'camera',
            'name': 'Film camera',
            'category': 'Cameras',
            'lowValue': 80,
            'typicalValue': 110,
            'highValue': 150,
            'confidence': 'medium',
            'effort': 'medium',
            'route': 'sell',
            'reason': 'Check the model number',
            'box': {'left': .1, 'top': .2, 'width': .3, 'height': .4},
          },
        ],
      }),
      projectId: 'garage',
    );

    expect(scan.items.single.name, 'Film camera');
    expect(scan.items.single.typicalValue, 110);
    expect(scan.items.single.boxTop, .2);
    expect(scan.bigTicketItems(), hasLength(1));
  });

  test('rejects a malformed response instead of inventing values', () {
    expect(
      () => ScanApi.parseResponse('{"items": []}', projectId: 'garage'),
      throwsFormatException,
    );
  });

  test('live uploads include explicit free-beta privacy consent', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return http.Response(
        jsonEncode({
          'sceneSummary': 'Shelf',
          'items': [
            {
              'id': 'lamp',
              'name': 'Lamp',
              'category': 'Home',
              'lowValue': 10,
              'typicalValue': 15,
              'highValue': 20,
              'confidence': 'medium',
              'effort': 'low',
              'route': 'sell',
              'reason': 'Visible lamp',
              'box': {'left': 0, 'top': 0, 'width': 1, 'height': 1},
            },
          ],
        }),
        200,
      );
    });

    await ScanApi(
      baseUrl: 'https://api.example',
      client: client,
    ).analyze(Uint8List.fromList([1, 2, 3]));

    expect(captured.headers['content-type'], contains('multipart/form-data'));
    expect(captured.body, contains('betaConsent'));
    expect(captured.body, contains('true'));
    expect(captured.body.toLowerCase(), contains('content-type: image/jpeg'));
  });
}
