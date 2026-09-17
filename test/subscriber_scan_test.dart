import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:cluttercash/services/scan_api.dart';
import 'package:cluttercash/services/subscriber.dart';
import 'package:cluttercash/domain/item.dart';

void main() {
  const item = ClutterItem(
    id: 'x',
    name: 'Lamp',
    lowValue: 1,
    typicalValue: 2,
    highValue: 3,
    confidence: Confidence.low,
    effort: SaleEffort.low,
    route: ItemRoute.sell,
  );
  test('explicit logout permits free scan transport, never before', () async {
    final s = SubscriberState(
      SubscriberApi(baseUrl: 'https://api.example'),
      paidIntent: true,
    );
    var sends = 0;
    final client = MockClient((r) async {
      sends++;
      expect(r.headers.containsKey('Authorization'), false);
      expect(r.headers['X-ClutterCash-Device'], 'b' * 64);
      return http.Response('{}', 503);
    });
    ScanApi api() => ScanApi(
      baseUrl: 'https://api.example',
      deviceToken: 'b' * 64,
      subscriberReauthRequired: s.reauthRequired,
      client: client,
    );
    final bytes = Uint8List.fromList([255, 216, 255]);
    await expectLater(api().analyze(bytes), throwsA(isA<ScanApiException>()));
    expect(sends, 0);
    await s.logout();
    await expectLater(api().analyze(bytes), throwsA(isA<ScanApiException>()));
    expect(sends, 1);
  });
  for (final label in [false, true]) {
    test(
      'reauth required blocks ${label ? 'label' : 'room'} before any free or invite send',
      () async {
        var sends = 0;
        final api = ScanApi(
          baseUrl: 'https://api.example',
          subscriberReauthRequired: true,
          inviteCode: 'old-invite',
          deviceToken: 'b' * 64,
          client: MockClient((r) async {
            sends++;
            return http.Response('{}', 500);
          }),
        );
        final bytes = Uint8List.fromList([255, 216, 255]);
        await expectLater(
          label ? api.identifyFromLabel(bytes, item) : api.analyze(bytes),
          throwsA(
            isA<ScanApiException>().having(
              (e) => e.message,
              'guidance',
              contains('Restore'),
            ),
          ),
        );
        expect(sends, 0);
      },
    );
    test(
      'paid ${label ? 'label' : 'scan'} prioritizes bearer and never retries free after expiry',
      () async {
        var sends = 0;
        final api = ScanApi(
          baseUrl: 'https://api.example',
          subscriberSession: 'a' * 64,
          inviteCode: 'old-invite',
          deviceToken: 'b' * 64,
          client: MockClient((r) async {
            sends++;
            expect(r.headers['Authorization'], 'Bearer ${'a' * 64}');
            expect(r.headers.containsKey('X-ClutterCash-Invite'), false);
            expect(r.headers.containsKey('X-ClutterCash-Device'), false);
            return http.Response('{}', 401);
          }),
        );
        final bytes = Uint8List.fromList([255, 216, 255]);
        await expectLater(
          label ? api.identifyFromLabel(bytes, item) : api.analyze(bytes),
          throwsA(
            isA<ScanApiException>().having(
              (e) => e.message,
              'guidance',
              contains('Sign out'),
            ),
          ),
        );
        expect(sends, 1);
      },
    );
  }
}
