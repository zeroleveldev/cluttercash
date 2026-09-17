import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:cluttercash/services/subscriber.dart';
import 'package:cluttercash/subscriber_landing.dart';

void main() {
  final token = 'a' * 64;
  SubscriberState state(
    List<String> calls, {
    bool enabled = true,
    int code = 200,
  }) => SubscriberState(
    SubscriberApi(
      baseUrl: 'https://api.example',
      enabled: enabled,
      client: MockClient((r) async {
        calls.add(r.url.path);
        expect(r.url.hasQuery, false);
        if (r.url.path.endsWith('/verify')) {
          expect(jsonDecode(r.body), {
            'token': token,
            'browserToken': 'b' * 64,
          });
          return http.Response(
            jsonEncode({
              'sessionToken': 'c' * 64,
              'expiresAt': DateTime.now()
                  .add(const Duration(hours: 1))
                  .millisecondsSinceEpoch,
            }),
            code,
          );
        }
        return http.Response(
          jsonEncode({
            'bound': true,
            'subscribed': true,
            'entitled': false,
            'state': 'awaiting_payment',
            'blocked': false,
            'remaining': 0,
            'monthlyAllowance': 10,
            'periodStart': null,
            'periodEnd': null,
            'renewalStatus': 'not_confirmed',
          }),
          200,
        );
      }),
    ),
    browserProof: 'b' * 64,
  );
  testWidgets(
    'reload without credential blocks paid intent until explicit logout',
    (tester) async {
      final calls = <String>[];
      var savedIntent = true;
      final s = SubscriberState(
        state(calls).api,
        paidIntent: savedIntent,
        savePaidIntent: (value) => savedIntent = value,
      );
      expect(s.reauthRequired, true);
      await tester.pumpWidget(MaterialApp(home: SubscriberLanding(state: s)));
      expect(
        find.textContaining('Paid access needs verification'),
        findsOneWidget,
      );
      expect(find.text('Send verification link / restore'), findsOneWidget);
      await tester.ensureVisible(find.text('Sign out'));
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      expect(savedIntent, false);
      expect(s.reauthRequired, false);
      expect(
        SubscriberState(
          state(calls).api,
          paidIntent: savedIntent,
        ).reauthRequired,
        false,
      );
      expect(calls, isEmpty);
    },
  );
  test('restored session is accepted without automatic requests', () {
    final calls = <String>[];
    final s = SubscriberState(state(calls).api, session: 'c' * 64);
    expect(s.sessionToken, 'c' * 64);
    expect(s.paidIntent, true);
    expect(calls, isEmpty);
  });
  test(
    'failed session persistence never installs authenticated state',
    () async {
      final calls = <String>[];
      final s = SubscriberState(
        state(calls).api,
        browserProof: 'b' * 64,
        saveSession: (value) {
          if (value != null) throw StateError('storage denied');
        },
      );
      await s.confirm(token);
      expect(s.sessionToken, isNull);
      expect(s.status, isNull);
    },
  );
  test('default feature gate sends nothing', () async {
    final calls = <String>[];
    final s = state(calls, enabled: false);
    await s.confirm(token);
    expect(calls, isEmpty);
    expect(s.sessionToken, isNull);
  });
  test('failed or malformed verification never creates a session', () async {
    final calls = <String>[];
    final s = state(calls, code: 401);
    await s.confirm('malformed');
    expect(calls, isEmpty);
    await s.confirm(token);
    expect(s.sessionToken, isNull);
    expect(s.message, contains('expired'));
  });
  test(
    'verified identity is not entitlement; status comes from server',
    () async {
      final calls = <String>[];
      final s = state(calls);
      await s.confirm(token);
      expect(s.sessionToken, isNotNull);
      expect(s.status, isNull);
      await s.refresh();
      expect(s.status!.entitled, false);
      expect(s.status!.state, 'awaiting_payment');
      expect(calls, ['/v1/subscriber/verify', '/v1/billing/status']);
      await s.logout();
      expect(s.sessionToken, isNull);
    },
  );
  testWidgets(
    'landing requires explicit confirmation, never auto pays or uploads',
    (tester) async {
      final calls = <String>[];
      final s = state(calls);
      await tester.pumpWidget(
        MaterialApp(
          home: SubscriberLanding(state: s, token: token),
        ),
      );
      await tester.pumpAndSettle();
      expect(calls, isEmpty);
      await tester.tap(find.text('Confirm verification'));
      await tester.pumpAndSettle();
      expect(calls, ['/v1/subscriber/verify']);
      expect(find.textContaining('Identity verified'), findsOneWidget);
    },
  );
  testWidgets('wrong browser gives safe restart guidance without requests', (
    tester,
  ) async {
    final calls = <String>[];
    final s = SubscriberState(state(calls).api);
    await tester.pumpWidget(
      MaterialApp(
        home: SubscriberLanding(state: s, token: token),
      ),
    );
    await tester.tap(find.text('Confirm verification'));
    await tester.pumpAndSettle();
    expect(calls, isEmpty);
    expect(find.textContaining('requesting browser'), findsOneWidget);
  });
}
