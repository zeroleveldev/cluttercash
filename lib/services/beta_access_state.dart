import 'package:shared_preferences/shared_preferences.dart';

import 'beta_access_api.dart';

const betaAccessRequestIdKey = 'cluttercash.betaAccessRequestId';
const betaAccessRequestTokenKey = 'cluttercash.betaAccessRequestToken';

BetaAccessReceipt? loadBetaAccessReceipt(SharedPreferences preferences) {
  final requestId = preferences.getString(betaAccessRequestIdKey)?.trim() ?? '';
  final requestToken =
      preferences.getString(betaAccessRequestTokenKey)?.trim() ?? '';
  if (!RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch(requestId) ||
      !RegExp(r'^[a-f0-9]{64}$').hasMatch(requestToken)) {
    return null;
  }
  return BetaAccessReceipt(requestId: requestId, requestToken: requestToken);
}

Future<void> saveBetaAccessReceipt(
  SharedPreferences preferences,
  BetaAccessReceipt receipt,
) async {
  await preferences.setString(betaAccessRequestIdKey, receipt.requestId);
  await preferences.setString(betaAccessRequestTokenKey, receipt.requestToken);
}

Future<void> clearBetaAccessReceipt(SharedPreferences preferences) async {
  await preferences.remove(betaAccessRequestIdKey);
  await preferences.remove(betaAccessRequestTokenKey);
}
