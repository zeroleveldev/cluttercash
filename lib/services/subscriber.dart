import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

final _hex = RegExp(r'^[a-f0-9]{64}$');
const testBillingEnabled = bool.fromEnvironment(
  'CLUTTERCASH_TEST_BILLING',
  defaultValue: false,
);

class SubscriberFailure implements Exception {
  const SubscriberFailure(this.message);
  final String message;
  @override
  String toString() => message;
}

class BillingStatus {
  BillingStatus(Map<String, dynamic> json)
    : state = json['state'] as String,
      remaining = json['remaining'] as int,
      bound = json['bound'] == true,
      entitled =
          json['entitled'] == true &&
          json['blocked'] == false &&
          json['state'] == 'active' &&
          json['remaining'] is int &&
          (json['remaining'] as int) > 0,
      periodEnd = json['periodEnd'] as int?;
  final String state;
  final int remaining;
  final bool bound, entitled;
  final int? periodEnd;
}

class SubscriberApi {
  SubscriberApi({
    required this.baseUrl,
    this.enabled = testBillingEnabled,
    http.Client? client,
  }) : _client = client ?? http.Client();
  final String baseUrl;
  final bool enabled;
  final http.Client _client;
  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, {
    String? session,
  }) async {
    if (!enabled) {
      throw const SubscriberFailure(
        'Test billing is not enabled. Free scans need no account.',
      );
    }
    try {
      final origin = Uri.parse(baseUrl);
      if (origin.scheme != 'https' ||
          origin.userInfo.isNotEmpty ||
          origin.hasQuery ||
          origin.hasFragment) {
        throw const FormatException();
      }
      final response = await _client
          .post(
            origin.resolve('/v1/$path'),
            headers: {
              'Content-Type': 'application/json',
              if (session != null) 'Authorization': 'Bearer $session',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
      if (response.statusCode == 401) {
        throw const SubscriberFailure(
          'Verification or session expired. Restart verification in the requesting browser.',
        );
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw const SubscriberFailure(
          'Subscriber service unavailable. Try again explicitly later.',
        );
      }
      return jsonDecode(response.body) as Map<String, dynamic>;
    } on SubscriberFailure {
      rethrow;
    } catch (_) {
      throw const SubscriberFailure(
        'Subscriber service unavailable. Try again explicitly later.',
      );
    }
  }
}

class SubscriberState extends ChangeNotifier {
  SubscriberState(
    this.api, {
    this.browserProof,
    this.saveProof,
    this.saveSession,
    this._session,
    bool paidIntent = false,
    this.savePaidIntent,
  }) : paidIntent = paidIntent || _session != null;
  final SubscriberApi api;
  String? browserProof, _session;
  final void Function(String?)? saveProof, saveSession;
  bool paidIntent;
  final void Function(bool)? savePaidIntent;
  bool get reauthRequired => paidIntent && _session == null;
  String? get sessionToken => _session;
  BillingStatus? status;
  bool busy = false;
  String message = '';
  Future<void> _run(Future<void> Function() action) async {
    if (busy) return;
    busy = true;
    message = '';
    notifyListeners();
    try {
      await action();
    } on SubscriberFailure catch (e) {
      message = e.message;
    } catch (_) {
      message = 'Subscriber service unavailable. Restart verification.';
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> challenge(String email) => _run(() async {
    if (!api.enabled) {
      throw const SubscriberFailure(
        'Test billing is not enabled. Free scans need no account.',
      );
    }
    final random = Random.secure();
    browserProof = List.generate(
      32,
      (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
    saveProof?.call(browserProof);
    await api.post('subscriber/challenge', {
      'email': email,
      'browserToken': browserProof,
    });
    message =
        'If accepted, a link will arrive. Open it in this requesting browser within ten minutes. On another browser, restart verification there.';
  });
  Future<void> confirm(String token) => _run(() async {
    _session = null;
    status = null;
    saveSession?.call(null);
    if (!_hex.hasMatch(token)) {
      throw const SubscriberFailure(
        'Invalid verification link. Restart verification.',
      );
    }
    if (browserProof == null || !_hex.hasMatch(browserProof!)) {
      throw const SubscriberFailure(
        'Open this link in the requesting browser, or restart verification in this browser.',
      );
    }
    final result = await api.post('subscriber/verify', {
      'token': token,
      'browserToken': browserProof,
    });
    final value = result['sessionToken'], expiry = result['expiresAt'];
    if (value is! String ||
        !_hex.hasMatch(value) ||
        expiry is! int ||
        expiry <= DateTime.now().millisecondsSinceEpoch) {
      throw const SubscriberFailure(
        'Verification expired. Restart verification.',
      );
    }
    // Set intent first: failed credential storage must not select free access.
    paidIntent = true;
    savePaidIntent?.call(true);
    // Commit in-memory authentication only after required storage succeeds.
    saveProof?.call(null);
    saveSession?.call(value);
    browserProof = null;
    _session = value;
    message =
        'Identity verified. This does not confirm payment or grant scans.';
  });
  Future<void> refresh() => _run(() async {
    status = null;
    if (_session == null) {
      throw const SubscriberFailure(
        'Verify your email again to restore server billing status.',
      );
    }
    final result = await api.post('billing/status', {}, session: _session);
    status = BillingStatus(result);
    message =
        'Server status: ${status!.state}. ${status!.remaining} scans remaining. Renewal is not confirmed.';
  });
  Future<Uri?> hosted({required bool portal}) async {
    Uri? url;
    await _run(() async {
      if (_session == null) {
        throw const SubscriberFailure('Verify your email before continuing.');
      }
      final data = await api.post(
        'billing/${portal ? 'portal' : 'checkout'}',
        {},
        session: _session,
      );
      final candidate = Uri.parse(data['url'] as String);
      if (candidate.scheme != 'https' ||
          candidate.host !=
              (portal ? 'billing.stripe.com' : 'checkout.stripe.com') ||
          candidate.userInfo.isNotEmpty ||
          candidate.port != 443) {
        throw const FormatException();
      }
      url = candidate;
    });
    return url;
  }

  Future<void> logout() => _run(() async {
    final old = _session;
    _session = null;
    status = null;
    saveSession?.call(null);
    browserProof = null;
    saveProof?.call(null);
    savePaidIntent?.call(false);
    paidIntent = false;
    if (old != null) await api.post('subscriber/logout', {}, session: old);
    message = 'Signed out of this session.';
  });
}
