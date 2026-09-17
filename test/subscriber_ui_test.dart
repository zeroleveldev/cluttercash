import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:url_launcher/link.dart';
import 'package:cluttercash/subscriber_landing.dart';
import 'package:cluttercash/main.dart';
import 'package:cluttercash/services/subscriber.dart';

void main() {
  testWidgets('home exposes optional subscription only behind feature flag', (
    t,
  ) async {
    await t.pumpWidget(const ClutterCashApp());
    final entry = find.text('Subscription / restore (test)');
    if (testBillingEnabled) {
      await t.scrollUntilVisible(entry, 300);
      await t.tap(entry);
      await t.pumpAndSettle();
      expect(find.byType(SubscriberLanding), findsOneWidget);
    } else {
      expect(entry, findsNothing);
    }
  });
  testWidgets(
    'optional restore sends email only explicitly with browser proof',
    (t) async {
      final calls = <http.Request>[];
      final s = SubscriberState(
        SubscriberApi(
          baseUrl: 'https://api.example',
          enabled: true,
          client: MockClient((r) async {
            calls.add(r);
            return http.Response('{}', 202);
          }),
        ),
      );
      await t.pumpWidget(MaterialApp(home: SubscriberLanding(state: s)));
      expect(calls, isEmpty);
      expect(find.textContaining('USD 1.99/month'), findsOneWidget);
      await t.enterText(find.byType(TextField), 'payer@example.com');
      await t.tap(find.text('Send verification link / restore'));
      await t.pumpAndSettle();
      expect(calls.single.url.path, '/v1/subscriber/challenge');
      expect(
        jsonDecode(calls.single.body)['browserToken'],
        matches(RegExp(r'^[a-f0-9]{64}$')),
      );
      expect(s.sessionToken, isNull);
      expect(find.textContaining('If accepted'), findsOneWidget);
    },
  );
  testWidgets(
    'hosted checkout and portal require explicit creation then native link; binding not entitlement',
    (t) async {
      final calls = <String>[];
      final s = SubscriberState(
        SubscriberApi(
          baseUrl: 'https://api.example',
          enabled: true,
          client: MockClient((r) async {
            calls.add(r.url.path);
            expect(r.headers['Authorization'], 'Bearer ${'a' * 64}');
            return http.Response(
              jsonEncode(
                r.url.path.endsWith('/status')
                    ? {
                        'bound': true,
                        'entitled': false,
                        'blocked': false,
                        'state': 'awaiting_payment',
                        'remaining': 0,
                        'periodEnd': null,
                      }
                    : {
                        'url': r.url.path.endsWith('/portal')
                            ? 'https://billing.stripe.com/p/session'
                            : 'https://checkout.stripe.com/c/pay/session',
                      },
              ),
              200,
            );
          }),
        ),
        session: 'a' * 64,
      );
      await t.pumpWidget(
        MaterialApp(home: SubscriberLanding(state: s, billingReturn: true)),
      );
      expect(calls, isEmpty);
      await t.ensureVisible(find.text('Prepare test Checkout'));
      await t.pumpAndSettle();
      await t.tap(find.text('Prepare test Checkout'));
      await t.pumpAndSettle();
      final link = t.widget<Link>(find.byType(Link));
      expect(link.uri.toString(), 'https://checkout.stripe.com/c/pay/session');
      expect(link.target, LinkTarget.self);
      expect(s.status, isNull);
      await t.tap(find.text('Refresh server billing status'));
      await t.pumpAndSettle();
      expect(find.textContaining('No paid scans available'), findsOneWidget);
      await t.ensureVisible(find.text('Prepare subscription management'));
      await t.tap(find.text('Prepare subscription management'));
      await t.pumpAndSettle();
      expect(
        t.widget<Link>(find.byType(Link)).uri.toString(),
        'https://billing.stripe.com/p/session',
      );
      await t.ensureVisible(find.text('Sign out'));
      await t.tap(find.text('Sign out'));
      await t.pumpAndSettle();
      expect(s.sessionToken, isNull);
      expect(find.byType(Link), findsNothing);
      expect(calls, [
        '/v1/billing/checkout',
        '/v1/billing/status',
        '/v1/billing/portal',
        '/v1/subscriber/logout',
      ]);
    },
  );
  testWidgets('disabled billing hides payment and email actions', (t) async {
    await t.pumpWidget(
      MaterialApp(
        home: SubscriberLanding(
          state: SubscriberState(
            SubscriberApi(baseUrl: 'https://api.example', enabled: false),
          ),
        ),
      ),
    );
    expect(find.byType(TextField), findsNothing);
    expect(find.text('Prepare test Checkout'), findsNothing);
  });
}
