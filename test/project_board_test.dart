import 'package:cluttercash/domain/item.dart';
import 'package:cluttercash/domain/project.dart';
import 'package:cluttercash/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('cash sprint records a sale and updates visible earnings', (
    tester,
  ) async {
    final project = CleanoutProject.empty(id: 'garage', name: 'Garage Reset')
        .addItem(
          const ClutterItem(
            id: 'camera',
            name: 'Film camera',
            lowValue: 140,
            typicalValue: 190,
            highValue: 260,
            confidence: Confidence.high,
            effort: SaleEffort.medium,
            route: ItemRoute.sell,
            status: ItemStatus.sell,
          ),
        );

    await tester.pumpWidget(
      MaterialApp(home: ProjectBoardScreen(project: project)),
    );
    expect(find.text('Garage Reset'), findsOneWidget);
    expect(find.text(r'$0 earned'), findsOneWidget);

    await tester.tap(find.text('Sold'));
    await tester.pumpAndSettle();

    expect(find.text(r'$171 earned'), findsOneWidget);
    expect(find.text('1 of 1 cleared'), findsOneWidget);
  });
}
