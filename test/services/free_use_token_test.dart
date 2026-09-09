import 'dart:math';

import 'package:cluttercash/services/free_use_token.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test(
    'creates one random no-registration token and reuses it on the device',
    () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();

      final first = await getOrCreateFreeUseToken(
        preferences,
        random: Random(123),
      );
      final second = await getOrCreateFreeUseToken(
        preferences,
        random: Random(999),
      );

      expect(first, matches(RegExp(r'^[a-f0-9]{64}$')));
      expect(second, first);
      expect(preferences.getString('cluttercash.freeUseToken'), first);
    },
  );
}
