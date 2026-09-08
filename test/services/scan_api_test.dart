import 'dart:convert';

import 'package:cluttercash/services/scan_api.dart';
import 'package:flutter_test/flutter_test.dart';

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
}
