import 'package:cluttercash/services/marketplace_link.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:url_launcher/url_launcher.dart';

void main() {
  test(
    'marketplace links open in the current web tab without clipboard fallback',
    () async {
      Uri? openedUri;
      LaunchMode? openedMode;
      String? openedWindow;

      final opened = await openMarketplaceLink(
        Uri.parse('https://www.ebay.com/sch/i.html?_nkw=camera'),
        platformLauncher:
            (
              uri, {
              mode = LaunchMode.platformDefault,
              webOnlyWindowName,
            }) async {
              openedUri = uri;
              openedMode = mode;
              openedWindow = webOnlyWindowName;
              return true;
            },
      );

      expect(opened, isTrue);
      expect(openedUri?.host, 'www.ebay.com');
      expect(openedMode, LaunchMode.platformDefault);
      expect(openedWindow, '_self');
    },
  );
}
