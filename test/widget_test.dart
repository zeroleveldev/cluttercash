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
}
