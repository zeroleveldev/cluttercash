import 'dart:convert';
import 'dart:typed_data';

import 'package:cluttercash/domain/item.dart';
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
            'listingTitle': 'Film camera — model unknown',
            'listingDescription':
                'Film camera. Confirm the model and working condition before posting.',
            'searchQuery': 'film camera body model unknown',
            'marketplace': 'ebay',
            'marketplaceReason': 'Camera buyers can compare models on eBay.',
            'missingDetails': ['Exact model', 'Working condition'],
            'box': {'left': .1, 'top': .2, 'width': .3, 'height': .4},
          },
        ],
      }),
      projectId: 'garage',
    );

    expect(scan.items.single.name, 'Film camera');
    expect(scan.items.single.typicalValue, 110);
    expect(scan.items.single.boxTop, .2);
    expect(scan.items.single.listingTitle, 'Film camera — model unknown');
    expect(scan.items.single.searchQuery, 'film camera body model unknown');
    expect(scan.items.single.marketplace.name, 'ebay');
    expect(scan.items.single.missingDetails, contains('Working condition'));
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

  test(
    'label upload refines the item and never requires a returned serial',
    () async {
      late http.Request captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'exactName': 'Canon AE-1 35mm film camera',
            'manufacturer': 'Canon',
            'model': 'AE-1',
            'confidence': 'high',
            'serialDetected': true,
            'searchQuery': 'Canon AE-1 35mm film camera body',
            'listingTitle': 'Canon AE-1 35mm Film Camera Body',
            'listingDescription':
                'Canon AE-1 camera body. Confirm operation and included accessories.',
            'marketplace': 'ebay',
            'marketplaceReason': 'Collectors search by exact model.',
            'missingDetails': ['Working condition', 'Included accessories'],
          }),
          200,
        );
      });
      const item = ClutterItem(
        id: 'camera',
        name: 'Vintage film camera',
        lowValue: 80,
        typicalValue: 110,
        highValue: 150,
        confidence: Confidence.medium,
        effort: SaleEffort.medium,
        route: ItemRoute.sell,
        category: 'Cameras',
        confirmedDetails: {'workingCondition': 'Shutter fires'},
      );

      final result = await ScanApi(
        baseUrl: 'https://api.example',
        client: client,
      ).identifyFromLabel(Uint8List.fromList([1, 2, 3]), item);

      expect(captured.url.path, '/v1/items/identify');
      expect(captured.body, contains('Vintage film camera'));
      expect(captured.body, contains('Cameras'));
      expect(captured.body.toLowerCase(), contains('content-type: image/jpeg'));
      expect(result.item.name, 'Canon AE-1 35mm film camera');
      expect(result.item.searchQuery, 'Canon AE-1 35mm film camera body');
      expect(result.item.listingDescription, contains('Shutter fires'));
      expect(result.manufacturer, 'Canon');
      expect(result.model, 'AE-1');
      expect(result.serialDetected, true);
    },
  );
}
