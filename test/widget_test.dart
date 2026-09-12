import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/scan_result.dart';
import 'package:cluttercash/main.dart';
import 'package:cluttercash/services/beta_access_api.dart';
import 'package:cluttercash/services/scan_api.dart';
import 'package:cluttercash/services/telemetry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/link.dart';

class _RecordedTelemetry {
  const _RecordedTelemetry(this.event, this.failure);
  final TelemetryEvent event;
  final TelemetryFailure? failure;
}

class _RecordingTelemetry implements TelemetryReporter {
  final events = <_RecordedTelemetry>[];

  @override
  Future<void> record(TelemetryEvent event, {TelemetryFailure? failure}) async {
    events.add(_RecordedTelemetry(event, failure));
  }
}

void main() {
  testWidgets(
    'beta invite entry stores a local code without showing it later',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(const MaterialApp(home: BetaInviteCodeScreen()));

      await tester.enterText(find.byType(TextField), 'tester-invite-code');
      await tester.tap(find.text('Save beta code'));
      await tester.pumpAndSettle();

      expect(
        await SharedPreferences.getInstance().then(
          (preferences) => preferences.getString('cluttercash.betaInviteCode'),
        ),
        'tester-invite-code',
      );
      expect(find.text('Beta code saved on this device'), findsOneWidget);
    },
  );

  testWidgets('beta invite request collects an email and confirms delivery', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    String? submittedEmail;
    String? submittedName;
    String? submittedDevice;
    await tester.pumpWidget(
      MaterialApp(
        home: BetaInviteRequestScreen(
          requestAccess: ({required email, required name, required device}) async {
            submittedEmail = email;
            submittedName = name;
            submittedDevice = device;
            return const BetaAccessReceipt(
              requestId: 'request-123',
              requestToken:
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            );
          },
        ),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextField, 'Email address'),
      'tester@example.com',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'First name (optional)'),
      'Taylor',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Device or browser (optional)'),
      'Android phone',
    );
    await tester.ensureVisible(find.text('Request access'));
    await tester.tap(find.text('Request access'));
    await tester.pumpAndSettle();

    expect(submittedEmail, 'tester@example.com');
    expect(submittedName, 'Taylor');
    expect(submittedDevice, 'Android phone');
    expect(find.text('Request sent'), findsOneWidget);
    expect(find.textContaining('review your request'), findsOneWidget);
    expect(find.text('Draft email request'), findsNothing);
  });

  testWidgets('saved approved request activates this browser without a code', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'cluttercash.betaAccessRequestId': 'request-123',
      'cluttercash.betaAccessRequestToken':
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    await tester.pumpWidget(
      MaterialApp(
        home: BetaInviteRequestScreen(
          checkStatus: (_) async => BetaAccessStatus.approved,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Access active'), findsOneWidget);
    expect(find.textContaining('No code or email is needed'), findsOneWidget);
    expect(find.text('Check approval status'), findsNothing);
  });

  testWidgets('live scan success replaces loading with the real result', (
    tester,
  ) async {
    final imageBytes = Uint8List.fromList(
      base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      ),
    );
    final result = ScanResult(
      id: 'live-scan',
      projectId: 'live-project',
      createdAt: DateTime.utc(2026, 9, 9),
      items: const [
        ClutterItem(
          id: 'live-mixer',
          name: 'KitchenAid Artisan mixer',
          lowValue: 120,
          typicalValue: 165,
          highValue: 210,
          confidence: Confidence.high,
          effort: SaleEffort.low,
          route: ItemRoute.sell,
          category: 'Kitchen appliances',
          reason: 'Recognizable model with resale demand.',
          searchQuery: 'KitchenAid Artisan stand mixer',
          marketplace: Marketplace.ebay,
          marketplaceReason: 'Model-specific marketplace research.',
        ),
      ],
    );
    final analysis = Completer<ScanResult>();
    final telemetry = _RecordingTelemetry();
    Uint8List? analyzedBytes;

    await tester.pumpWidget(
      TelemetryScope(
        reporter: telemetry,
        child: MaterialApp(
          home: AnalyzingScreen(
            imageBytes: imageBytes,
            analyze: (bytes) {
              analyzedBytes = bytes;
              return analysis.future;
            },
          ),
        ),
      ),
    );

    expect(find.text('Finding the good stuff…'), findsOneWidget);
    expect(analyzedBytes, same(imageBytes));

    analysis.complete(result);
    await tester.pumpAndSettle();

    expect(find.text('KitchenAid Artisan mixer'), findsOneWidget);
    expect(find.text(r'$120–$210'), findsAtLeastNWidgets(1));
    expect(find.text('DEMO'), findsNothing);
    expect(find.text('Vintage film camera'), findsNothing);
    expect(find.text('We couldn’t analyze this photo'), findsNothing);
    expect(telemetry.events.map((entry) => entry.event), [
      TelemetryEvent.scanStarted,
      TelemetryEvent.scanSucceeded,
    ]);
  });

  testWidgets('live scan failure shows an honest error without demo values', (
    tester,
  ) async {
    final imageBytes = Uint8List.fromList(
      base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      ),
    );

    final telemetry = _RecordingTelemetry();
    await tester.pumpWidget(
      TelemetryScope(
        reporter: telemetry,
        child: MaterialApp(
          home: AnalyzingScreen(
            imageBytes: imageBytes,
            analyze: (_) async => throw const ScanApiException(
              'Beta limit reached until tomorrow.',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('We couldn’t analyze this photo'), findsOneWidget);
    expect(find.text('Beta limit reached until tomorrow.'), findsOneWidget);
    expect(find.text('See a clearly labeled demo result'), findsOneWidget);
    expect(find.text('Vintage film camera'), findsNothing);
    expect(find.text('Potential resale value'), findsNothing);
    expect(telemetry.events.map((entry) => entry.event), [
      TelemetryEvent.scanStarted,
      TelemetryEvent.scanFailed,
    ]);
    expect(telemetry.events.last.failure, TelemetryFailure.api);
  });

  testWidgets(
    'creating a local project records one metadata-free funnel event',
    (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      SharedPreferences.setMockInitialValues({});
      final telemetry = _RecordingTelemetry();
      final result = ScanResult(
        id: 'scan',
        projectId: 'project',
        createdAt: DateTime.utc(2026, 9, 9),
        items: const [
          ClutterItem(
            id: 'lamp',
            name: 'Lamp',
            lowValue: 10,
            typicalValue: 15,
            highValue: 20,
            confidence: Confidence.medium,
            effort: SaleEffort.low,
            route: ItemRoute.sell,
            category: 'Home',
          ),
        ],
      );

      await tester.pumpWidget(
        TelemetryScope(
          reporter: telemetry,
          child: MaterialApp(home: ResultsScreen(result: result)),
        ),
      );
      final startProject = find.text('Start clearing 1 items');
      await tester.scrollUntilVisible(
        startProject,
        300,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(startProject);
      await tester.pumpAndSettle();

      expect(telemetry.events.map((entry) => entry.event), [
        TelemetryEvent.projectCreated,
      ]);
    },
  );

  testWidgets('opens with one clear camera-first promise', (tester) async {
    await tester.pumpWidget(const ClutterCashApp());

    expect(find.text('Point at the mess.'), findsOneWidget);
    expect(find.text('Find the money.'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Scan my space'), findsOneWidget);
    expect(
      find.text('No account or code needed for 3 free analyses'),
      findsOneWidget,
    );
  });

  testWidgets('opens the privacy and beta terms from the welcome screen', (
    tester,
  ) async {
    await tester.pumpWidget(const ClutterCashApp());

    final terms = find.text('Privacy & beta terms');
    await tester.ensureVisible(terms);
    await tester.tap(terms);
    await tester.pumpAndSettle();

    expect(find.text('Privacy & beta terms'), findsOneWidget);
    expect(find.text('Free beta'), findsOneWidget);
    expect(find.textContaining('Effective September 10, 2026'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -1200));
    await tester.pumpAndSettle();
    expect(find.textContaining('event names'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -800));
    await tester.pumpAndSettle();
    expect(find.text('cluttercash.help@gmail.com'), findsOneWidget);
  });

  testWidgets('free beta results do not show upgrade or share controls', (
    tester,
  ) async {
    await tester.pumpWidget(const ClutterCashApp());
    final scanButton = find.widgetWithText(FilledButton, 'Scan my space');
    await tester.ensureVisible(scanButton);
    await tester.tap(scanButton);
    await tester.pumpAndSettle();
    final demoButton = find.text('Try the demo room');
    await tester.ensureVisible(demoButton);
    await tester.tap(demoButton);
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    expect(find.textContaining('Unlock full project'), findsNothing);
    expect(find.byIcon(Icons.ios_share_rounded), findsNothing);
    expect(find.textContaining('Production image analysis'), findsNothing);
  });

  testWidgets('demo scan reveals totals, big-ticket item, and action queue', (
    tester,
  ) async {
    await tester.pumpWidget(const ClutterCashApp());
    final scanButton = find.widgetWithText(FilledButton, 'Scan my space');
    await tester.ensureVisible(scanButton);
    await tester.tap(scanButton);
    await tester.pumpAndSettle();
    final demoButton = find.text('Try the demo room');
    await tester.ensureVisible(demoButton);
    await tester.tap(demoButton);
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    expect(find.text('Potential resale value'), findsOneWidget);
    expect(find.text('BIG TICKET'), findsAtLeastNWidgets(1));
    expect(find.text('Your action queue'), findsOneWidget);
    expect(find.text('Vintage film camera'), findsOneWidget);
    expect(find.text('38 min'), findsNothing);
    expect(find.text('12 ft²'), findsNothing);
    expect(find.text('potential range'), findsOneWidget);
  });
  testWidgets(
    'item details stay focused on research and correction without listing tools',
    (tester) async {
      await tester.pumpWidget(const ClutterCashApp());
      final scanButton = find.widgetWithText(FilledButton, 'Scan my space');
      await tester.ensureVisible(scanButton);
      await tester.tap(scanButton);
      await tester.pumpAndSettle();
      final demoButton = find.text('Try the demo room');
      await tester.ensureVisible(demoButton);
      await tester.tap(demoButton);
      await tester.pump();
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      final item = find.text('Vintage film camera');
      final itemCard = find.ancestor(of: item, matching: find.byType(InkWell));
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -260));
      await tester.pumpAndSettle();
      await tester.tap(itemCard.first);
      await tester.pumpAndSettle();

      expect(find.text('Price research'), findsOneWidget);
      expect(find.text('Sold results'), findsOneWidget);
      expect(find.text('Active listings'), findsOneWidget);
      expect(find.textContaining('asking prices'), findsOneWidget);
      expect(find.text('Improve with a model-label photo'), findsOneWidget);
      expect(find.text('Editable listing draft'), findsNothing);
      expect(find.text('Answer listing questions'), findsNothing);
      expect(find.widgetWithText(TextField, 'Title'), findsNothing);
      expect(find.widgetWithText(TextField, 'Description'), findsNothing);
      expect(find.text('Copy edited listing'), findsNothing);
      expect(find.text('I need to correct this item'), findsOneWidget);

      final labelPhoto = find.text('Improve with a model-label photo');
      await tester.ensureVisible(labelPhoto);
      await tester.pumpAndSettle();
      await tester.tap(labelPhoto);
      await tester.pumpAndSettle();
      expect(find.text('Photograph the model label'), findsOneWidget);
      expect(find.textContaining('unique serial number'), findsOneWidget);
    },
  );

  testWidgets('marketplace research controls use real browser links', (
    tester,
  ) async {
    final result = ScanResult(
      id: 'local-item-scan',
      projectId: 'local-item-project',
      createdAt: DateTime(2026),
      items: const [
        ClutterItem(
          id: 'chair',
          name: 'Wood dining chair',
          lowValue: 20,
          typicalValue: 35,
          highValue: 50,
          confidence: Confidence.medium,
          effort: SaleEffort.low,
          route: ItemRoute.sell,
          searchQuery: 'wood dining chair',
          marketplace: Marketplace.localPickup,
          marketplaceReason: 'Bulky item suited to a nearby buyer.',
        ),
      ],
    );
    await tester.pumpWidget(MaterialApp(home: ResultsScreen(result: result)));

    final itemCard = find.ancestor(
      of: find.text('Wood dining chair'),
      matching: find.byType(InkWell),
    );
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -300));
    await tester.pumpAndSettle();
    await tester.tap(itemCard.first);
    await tester.pumpAndSettle();

    Link linkFor(Finder control) => tester.widget<Link>(
      find.ancestor(of: control, matching: find.byType(Link)).first,
    );

    final sold = linkFor(find.widgetWithText(FilledButton, 'Sold results'));
    final active = linkFor(
      find.widgetWithText(OutlinedButton, 'Active listings'),
    );
    final local = linkFor(
      find.widgetWithText(OutlinedButton, 'Search Local pickup'),
    );

    expect(sold.uri?.host, 'www.ebay.com');
    expect(sold.uri?.queryParameters['LH_Sold'], '1');
    expect(active.uri?.host, 'www.ebay.com');
    expect(active.uri?.queryParameters.containsKey('LH_Sold'), isFalse);
    expect(local.uri?.host, 'www.facebook.com');
    expect(sold.target, LinkTarget.blank);
    expect(active.target, LinkTarget.blank);
    expect(local.target, LinkTarget.blank);
  });

  testWidgets('item correction updates the potential selling range', (
    tester,
  ) async {
    final telemetry = _RecordingTelemetry();
    await tester.pumpWidget(ClutterCashApp(telemetry: telemetry));
    final scanButton = find.widgetWithText(FilledButton, 'Scan my space');
    await tester.ensureVisible(scanButton);
    await tester.tap(scanButton);
    await tester.pumpAndSettle();
    final demoButton = find.text('Try the demo room');
    await tester.ensureVisible(demoButton);
    await tester.tap(demoButton);
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    final itemCard = find.ancestor(
      of: find.text('Vintage film camera'),
      matching: find.byType(InkWell),
    );
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -260));
    await tester.pumpAndSettle();
    await tester.tap(itemCard.first);
    await tester.pumpAndSettle();

    final correctItem = find.text('I need to correct this item');
    await tester.ensureVisible(correctItem);
    await tester.tap(correctItem);
    await tester.pumpAndSettle();

    expect(find.text('Correct this item'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, 'Item name'),
      'Canon AE-1 Program camera',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Low potential value'),
      '180',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Typical potential value'),
      '240',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'High potential value'),
      '320',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Save correction'));
    await tester.pumpAndSettle();

    expect(find.text('Canon AE-1 Program camera'), findsAtLeastNWidgets(1));
    expect(find.text(r'$180–$320 AI estimate'), findsOneWidget);
    expect(
      telemetry.events.map((entry) => entry.event),
      contains(TelemetryEvent.itemCorrected),
    );
  });
}
