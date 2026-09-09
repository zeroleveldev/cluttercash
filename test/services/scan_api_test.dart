import 'dart:convert';
import 'dart:typed_data';

import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/services/scan_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

String multipartBody(http.Request request) =>
    utf8.decode(request.bodyBytes, allowMalformed: true);

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
            'searchQuery': 'film camera body model unknown',
            'marketplace': 'ebay',
            'marketplaceReason': 'Camera buyers can compare models on eBay.',

            'box': {'left': .1, 'top': .2, 'width': .3, 'height': .4},
          },
        ],
      }),
      projectId: 'garage',
    );

    expect(scan.items.single.name, 'Film camera');
    expect(scan.items.single.typicalValue, 110);
    expect(scan.items.single.boxTop, .2);
    expect(scan.items.single.searchQuery, 'film camera body model unknown');
    expect(scan.items.single.marketplace.name, 'ebay');
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
      inviteCode: 'invite-123',
      client: client,
    ).analyze(Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0]));

    expect(captured.headers['content-type'], contains('multipart/form-data'));
    expect(captured.headers['x-cluttercash-invite'], 'invite-123');
    final body = multipartBody(captured);
    expect(body, contains('betaConsent'));
    expect(body, contains('true'));
    expect(body.toLowerCase(), contains('content-type: image/jpeg'));
  });

  test('scan upload preserves PNG content type and filename', () async {
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
            },
          ],
        }),
        200,
      );
    });

    await ScanApi(
      baseUrl: 'https://api.example',
      inviteCode: 'invite-123',
      client: client,
    ).analyze(
      Uint8List.fromList([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    final body = multipartBody(captured);
    expect(body.toLowerCase(), contains('content-type: image/png'));
    expect(body, contains('filename="room.png"'));
  });

  test('label upload preserves WebP content type and filename', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return http.Response(
        jsonEncode({
          'exactName': 'Lamp model A',
          'manufacturer': 'Acme',
          'model': 'A',
          'confidence': 'high',
        }),
        200,
      );
    });
    const item = ClutterItem(
      id: 'lamp',
      name: 'Lamp',
      lowValue: 10,
      typicalValue: 15,
      highValue: 20,
      confidence: Confidence.medium,
      effort: SaleEffort.low,
      route: ItemRoute.sell,
      category: 'Home',
    );

    await ScanApi(
      baseUrl: 'https://api.example',
      inviteCode: 'invite-123',
      client: client,
    ).identifyFromLabel(
      Uint8List.fromList([
        0x52,
        0x49,
        0x46,
        0x46,
        0x00,
        0x00,
        0x00,
        0x00,
        0x57,
        0x45,
        0x42,
        0x50,
      ]),
      item,
    );

    final body = multipartBody(captured);
    expect(body.toLowerCase(), contains('content-type: image/webp'));
    expect(body, contains('filename="model-label.webp"'));
  });

  test('unsupported image bytes are rejected before upload', () async {
    var sends = 0;
    final client = MockClient((request) async {
      sends += 1;
      return http.Response('{}', 200);
    });

    await expectLater(
      ScanApi(
        baseUrl: 'https://api.example',
        inviteCode: 'invite-123',
        client: client,
      ).analyze(Uint8List.fromList([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])),
      throwsA(
        isA<ScanApiException>().having(
          (error) => error.message,
          'message',
          contains('JPEG, PNG, or WebP'),
        ),
      ),
    );
    expect(sends, 0);
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

            'marketplace': 'ebay',
            'marketplaceReason': 'Collectors search by exact model.',
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
      );

      final result = await ScanApi(
        baseUrl: 'https://api.example',
        inviteCode: 'invite-123',
        client: client,
      ).identifyFromLabel(Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0]), item);

      expect(captured.url.path, '/v1/items/identify');
      expect(captured.headers['x-cluttercash-invite'], 'invite-123');
      final body = multipartBody(captured);
      expect(body, contains('Vintage film camera'));
      expect(body, contains('Cameras'));
      expect(body.toLowerCase(), contains('content-type: image/jpeg'));
      expect(result.item.name, 'Canon AE-1 35mm film camera');
      expect(result.item.searchQuery, 'Canon AE-1 35mm film camera body');

      expect(result.manufacturer, 'Canon');
      expect(result.model, 'AE-1');
      expect(result.serialDetected, true);
    },
  );
}
