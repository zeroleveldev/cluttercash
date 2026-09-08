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

      await tester.tap(find.text('Improve with a model-label photo'));
      await tester.pumpAndSettle();
      expect(find.text('Photograph the model label'), findsOneWidget);
      expect(find.textContaining('unique serial number'), findsOneWidget);
    },
  );
}
