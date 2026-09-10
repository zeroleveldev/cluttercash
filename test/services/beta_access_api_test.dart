import 'package:cluttercash/services/beta_access_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('submits contact details to the Worker access-request endpoint', () async {
    late http.Request request;
    final client = MockClient((incoming) async {
      request = incoming;
      return http.Response(
        '{"accepted":true,"requestId":"request-123","requestToken":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}',
        202,
      );
    });

    final receipt =
        await BetaAccessApi(
          baseUrl: 'https://api.example/',
          client: client,
        ).requestAccess(
          email: ' Tester@Example.com ',
          name: 'Taylor',
          device: 'Android phone',
          deviceToken: 'a' * 64,
        );

    expect(request.url.toString(), 'https://api.example/v1/access-requests');
    expect(request.method, 'POST');
    expect(request.headers['content-type'], contains('application/json'));
    expect(request.headers['x-cluttercash-device'], 'a' * 64);
    expect(request.body, contains('tester@example.com'));
    expect(request.body, contains('Taylor'));
    expect(request.body, contains('Android phone'));
    expect(receipt.requestId, 'request-123');
    expect(
      receipt.requestToken,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  test('checks private approval status with the saved request token', () async {
    late http.Request request;
    final client = MockClient((incoming) async {
      request = incoming;
      return http.Response('{"status":"approved"}', 200);
    });
    final status =
        await BetaAccessApi(
          baseUrl: 'https://api.example',
          client: client,
        ).checkStatus(
          const BetaAccessReceipt(
            requestId: 'request-123',
            requestToken:
                'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          ),
        );

    expect(
      request.url.toString(),
      'https://api.example/v1/access-requests/request-123/status',
    );
    expect(
      request.headers['x-cluttercash-request'],
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(status, BetaAccessStatus.approved);
  });

  test(
    'shows the Worker error when an access request cannot be delivered',
    () async {
      final client = MockClient(
        (_) async => http.Response(
          '{"error":"The request could not be delivered."}',
          503,
        ),
      );

      expect(
        () => BetaAccessApi(
          baseUrl: 'https://api.example',
          client: client,
        ).requestAccess(email: 'tester@example.com', deviceToken: 'a' * 64),
        throwsA(
          isA<BetaAccessApiException>().having(
            (error) => error.message,
            'message',
            contains('could not be delivered'),
          ),
        ),
      );
    },
  );
}
