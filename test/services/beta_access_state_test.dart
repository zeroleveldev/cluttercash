import 'package:cluttercash/services/beta_access_api.dart';
import 'package:cluttercash/services/beta_access_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('persists the private request receipt on this browser only', () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    const receipt = BetaAccessReceipt(
      requestId: 'request-123',
      requestToken:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    await saveBetaAccessReceipt(preferences, receipt);
    expect(loadBetaAccessReceipt(preferences)?.requestId, receipt.requestId);
    expect(
      loadBetaAccessReceipt(preferences)?.requestToken,
      receipt.requestToken,
    );

    await clearBetaAccessReceipt(preferences);
    expect(loadBetaAccessReceipt(preferences), isNull);
  });

  test('rejects incomplete or malformed saved request state', () async {
    SharedPreferences.setMockInitialValues({
      betaAccessRequestIdKey: '../wrong',
      betaAccessRequestTokenKey: 'short',
    });
    final preferences = await SharedPreferences.getInstance();
    expect(loadBetaAccessReceipt(preferences), isNull);
  });
}
