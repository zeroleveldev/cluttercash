import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

const freeUseTokenStorageKey = 'cluttercash.freeUseToken';

Future<String> getOrCreateFreeUseToken(
  SharedPreferences preferences, {
  Random? random,
}) async {
  final saved = preferences.getString(freeUseTokenStorageKey)?.trim() ?? '';
  if (RegExp(r'^[a-f0-9]{64}$').hasMatch(saved)) return saved;

  final source = random ?? Random.secure();
  final token = List<int>.generate(
    32,
    (_) => source.nextInt(256),
  ).map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  await preferences.setString(freeUseTokenStorageKey, token);
  return token;
}
