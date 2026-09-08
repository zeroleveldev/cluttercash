import 'package:cluttercash/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('opens with one clear camera-first promise', (tester) async {
    await tester.pumpWidget(const ClutterCashApp());

    expect(find.text('Point at the mess.'), findsOneWidget);
    expect(find.text('Find the money.'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Scan my space'), findsOneWidget);
    expect(find.textContaining('No account'), findsOneWidget);
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

    expect(find.text('Cash hiding here'), findsOneWidget);
    expect(find.text('BIG TICKET'), findsAtLeastNWidgets(1));
    expect(find.text('Your action queue'), findsOneWidget);
    expect(find.text('Vintage film camera'), findsOneWidget);
  });
  testWidgets(
    'item details offer evidence links and an editable listing draft',
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
      expect(find.text('Editable listing draft'), findsOneWidget);
      expect(find.textContaining('asking prices'), findsOneWidget);
      expect(find.text('Improve with a model-label photo'), findsOneWidget);
      final questions = find.text('Answer listing questions');
      expect(questions, findsOneWidget);
      await tester.ensureVisible(questions);
      await tester.tap(questions);
      await tester.pumpAndSettle();
      expect(find.text('Confirm the listing details'), findsOneWidget);
      expect(find.text('Working condition'), findsOneWidget);
      expect(find.text('Cosmetic wear or damage'), findsOneWidget);
      expect(find.text('Measurements'), findsOneWidget);
      expect(find.text('Included items and accessories'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextField, 'Working condition'),
        'Shutter fires and meter responds',
      );
      tester.testTextInput.hide();
      await tester.pumpAndSettle();
      final updateDraft = find.text('Update listing draft');
      await tester.ensureVisible(updateDraft);
      await tester.pumpAndSettle();
      await tester.tap(updateDraft);
      await tester.pumpAndSettle();
      expect(find.textContaining('Listing refreshed with 1'), findsOneWidget);
      final description = tester.widget<TextField>(
        find.widgetWithText(TextField, 'Description'),
      );
      expect(
        description.controller?.text,
        contains('Shutter fires and meter responds'),
      );

      final labelPhoto = find.text('Improve with a model-label photo');
      await tester.ensureVisible(labelPhoto);
      await tester.pumpAndSettle();
      await tester.tap(labelPhoto);
      await tester.pumpAndSettle();
      expect(find.text('Photograph the model label'), findsOneWidget);
      expect(find.textContaining('unique serial number'), findsOneWidget);
    },
  );
}
