import 'package:cluttercash/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TestPicker extends ImagePicker {
  LostDataResponse response = LostDataResponse.empty();
  bool throws = false;
  int recoveries = 0;
  int picks = 0;
  ImageSource? source;
  @override
  Future<LostDataResponse> retrieveLostData() async {
    recoveries++;
    if (throws) throw PlatformException(code: 'PRIVATE-error');
    return response;
  }

  @override
  Future<XFile?> pickImage({
    required ImageSource source,
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    CameraDevice preferredCameraDevice = CameraDevice.rear,
    bool requestFullMetadata = true,
  }) async {
    picks++;
    this.source = source;
    expect(maxWidth, 1800);
    expect(imageQuality, 82);
    return XFile.fromData(
      Uint8List.fromList([255, 216, 255]),
      name: 'test.jpg',
    );
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'CC-17 empty recovery is silent and checked once across rebuilds',
    (tester) async {
      final picker = TestPicker();
      await tester.pumpWidget(ClutterCashApp(picker: picker));
      await tester.pumpAndSettle();
      await tester.pumpWidget(ClutterCashApp(picker: picker));
      await tester.pumpAndSettle();
      expect(picker.recoveries, 1);
      expect(find.byType(AlertDialog), findsNothing);
    },
  );
  testWidgets(
    'CC-17 unknown room or label recovery never auto uploads or replays',
    (tester) async {
      final picker = TestPicker()
        ..response = LostDataResponse(
          files: [XFile('unread-private-photo.jpg')],
          type: RetrieveType.image,
        );
      await tester.pumpWidget(ClutterCashApp(picker: picker));
      await tester.pumpAndSettle();
      expect(find.text('Photo selection interrupted'), findsOneWidget);
      expect(find.textContaining('model-label'), findsOneWidget);
      expect(find.byType(AnalyzingScreen), findsNothing);
      expect(picker.picks, 0);
      await tester.tap(find.text('Start a new scan'));
      await tester.pumpAndSettle();
      expect(find.byType(CaptureScreen), findsOneWidget);
      expect(find.byType(AnalyzingScreen), findsNothing);
      expect(picker.picks, 0);
      final gallery = find.text('Choose a photo');
      await tester.ensureVisible(gallery);
      await tester.tap(gallery);
      await tester.pumpAndSettle();
      expect(find.text('Free AI beta privacy'), findsOneWidget);
      expect(find.byType(AnalyzingScreen), findsNothing);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(find.byType(AnalyzingScreen), findsNothing);
      expect(picker.picks, 1);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(picker.recoveries, 1);
      expect(find.byType(AlertDialog), findsNothing);
    },
  );
  for (final thrown in [false, true]) {
    testWidgets('CC-17 recovery error is safe and dismissible thrown=$thrown', (
      tester,
    ) async {
      final picker = TestPicker()
        ..throws = thrown
        ..response = LostDataResponse(
          exception: PlatformException(code: 'PRIVATE-error'),
        );
      await tester.pumpWidget(ClutterCashApp(picker: picker));
      await tester.pumpAndSettle();
      expect(find.text('Photo selection interrupted'), findsOneWidget);
      expect(find.textContaining('PRIVATE-error'), findsNothing);
      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.byType(AnalyzingScreen), findsNothing);
      expect(picker.recoveries, 1);
    });
  }
  testWidgets('CC-17 normal gallery still requires explicit upload consent', (
    tester,
  ) async {
    final picker = TestPicker();
    await tester.pumpWidget(MaterialApp(home: CaptureScreen(picker: picker)));
    await tester.pumpAndSettle();
    final gallery = find.text('Choose a photo');
    await tester.ensureVisible(gallery);
    await tester.tap(gallery);
    await tester.pumpAndSettle();
    expect(picker.picks, 1);
    expect(picker.source, ImageSource.gallery);
    expect(find.text('Free AI beta privacy'), findsOneWidget);
    expect(find.byType(AnalyzingScreen), findsNothing);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.byType(CaptureScreen), findsOneWidget);
    expect(find.byType(AnalyzingScreen), findsNothing);
  });
}
