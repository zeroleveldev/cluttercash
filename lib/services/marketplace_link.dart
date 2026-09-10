import 'package:url_launcher/url_launcher.dart';

typedef MarketplacePlatformLauncher =
    Future<bool> Function(
      Uri uri, {
      LaunchMode mode,
      String? webOnlyWindowName,
    });

Future<bool> openMarketplaceLink(
  Uri uri, {
  MarketplacePlatformLauncher platformLauncher = launchUrl,
}) => platformLauncher(
  uri,
  mode: LaunchMode.platformDefault,
  webOnlyWindowName: '_self',
);
