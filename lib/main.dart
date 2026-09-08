import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'domain/item.dart';
import 'domain/project.dart';
import 'domain/scan_result.dart';
import 'services/project_store.dart';
import 'services/scan_api.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const ClutterCashApp());
}

const _ink = Color(0xFF14231B);
const _forest = Color(0xFF1F4D36);
const _lime = Color(0xFFB9F26B);
const _cream = Color(0xFFF7F4EA);
const _paper = Color(0xFFFFFDF7);
const _muted = Color(0xFF637067);
const _orange = Color(0xFFFFA655);

class ClutterCashApp extends StatelessWidget {
  const ClutterCashApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'ClutterCash',
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: _forest,
        primary: _forest,
        secondary: _lime,
        surface: _paper,
      ),
      scaffoldBackgroundColor: _cream,
      fontFamily: 'sans-serif',
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 47,
          height: .96,
          fontWeight: FontWeight.w900,
          letterSpacing: -2.2,
          color: _ink,
        ),
        headlineLarge: TextStyle(
          fontSize: 32,
          height: 1.05,
          fontWeight: FontWeight.w900,
          letterSpacing: -1.2,
          color: _ink,
        ),
        headlineMedium: TextStyle(
          fontSize: 24,
          height: 1.1,
          fontWeight: FontWeight.w800,
          letterSpacing: -.7,
          color: _ink,
        ),
        titleLarge: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: _ink,
        ),
        bodyLarge: TextStyle(fontSize: 16, height: 1.45, color: _muted),
        bodyMedium: TextStyle(fontSize: 14, height: 1.4, color: _muted),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: _ink,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(58),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: _paper,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
    ),
    home: const WelcomeScreen(),
  );
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 30),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _BrandMark(),
                const SizedBox(height: 34),
                const _Eyebrow('TURN CLUTTER INTO CASH'),
                const SizedBox(height: 12),
                Text(
                  'Point at the mess.',
                  style: Theme.of(context).textTheme.displayLarge,
                ),
                Text(
                  'Find the money.',
                  style: Theme.of(
                    context,
                  ).textTheme.displayLarge?.copyWith(color: _forest),
                ),
                const SizedBox(height: 16),
                Text(
                  'Scan a shelf, closet, or garage. We’ll spot what may be worth selling—and tell you what deserves your time.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 26),
                const _HeroReveal(),
                const SizedBox(height: 22),
                FilledButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CaptureScreen()),
                  ),
                  icon: const Icon(Icons.center_focus_strong_rounded),
                  label: const Text('Scan my space'),
                ),
                const SizedBox(height: 13),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.lock_outline_rounded, size: 16, color: _muted),
                    SizedBox(width: 7),
                    Flexible(
                      child: Text(
                        'No account needed for your first scan',
                        style: TextStyle(
                          color: _muted,
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                const Row(
                  children: [
                    Expanded(
                      child: _TinyFeature(
                        icon: Icons.sell_outlined,
                        title: 'Net value',
                        caption: 'Not hype',
                      ),
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: _TinyFeature(
                        icon: Icons.bolt_rounded,
                        title: 'Best first',
                        caption: 'Ranked for you',
                      ),
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: _TinyFeature(
                        icon: Icons.home_outlined,
                        title: 'Clear space',
                        caption: 'Track progress',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();
  @override
  Widget build(BuildContext context) => const Row(
    children: [
      DecoratedBox(
        decoration: BoxDecoration(
          color: _ink,
          borderRadius: BorderRadius.all(Radius.circular(13)),
        ),
        child: SizedBox(
          width: 42,
          height: 42,
          child: Icon(Icons.auto_awesome_rounded, color: _lime, size: 23),
        ),
      ),
      SizedBox(width: 11),
      Text(
        'ClutterCash',
        style: TextStyle(
          fontSize: 21,
          fontWeight: FontWeight.w900,
          letterSpacing: -.6,
          color: _ink,
        ),
      ),
      Spacer(),
      _Pill(text: 'BETA', color: _forest),
    ],
  );
}

class _HeroReveal extends StatelessWidget {
  const _HeroReveal();
  @override
  Widget build(BuildContext context) => Container(
    height: 225,
    decoration: BoxDecoration(
      color: _ink,
      borderRadius: BorderRadius.circular(28),
      boxShadow: const [
        BoxShadow(
          color: Color(0x2414231B),
          blurRadius: 24,
          offset: Offset(0, 14),
        ),
      ],
    ),
    child: Stack(
      children: [
        const Positioned.fill(child: CustomPaint(painter: _ClutterPainter())),
        Positioned(
          left: 17,
          top: 16,
          child: _ScanCorner(label: 'VINTAGE CAMERA', value: r'$140–$260'),
        ),
        Positioned(
          right: 16,
          top: 89,
          child: _ScanCorner(
            label: 'TOOL SET',
            value: r'$75–$110',
            accent: _orange,
          ),
        ),
        Positioned(
          left: 18,
          bottom: 17,
          right: 18,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(17),
            ),
            child: const Row(
              children: [
                Icon(Icons.payments_outlined, color: _forest),
                SizedBox(width: 10),
                Text(
                  'Possible value',
                  style: TextStyle(fontWeight: FontWeight.w700, color: _muted),
                ),
                Spacer(),
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      r'$355–$525',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: _ink,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _ClutterPainter extends CustomPainter {
  const _ClutterPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final muted = Paint()..color = const Color(0xFF304238);
    final light = Paint()..color = const Color(0xFF476253);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(30, 68, 82, 80),
        const Radius.circular(8),
      ),
      muted,
    );
    canvas.drawRect(const Rect.fromLTWH(47, 83, 48, 9), light);
    canvas.drawCircle(
      const Offset(72, 112),
      23,
      Paint()..color = const Color(0xFF0E1813),
    );
    canvas.drawCircle(const Offset(72, 112), 12, light);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width - 120, 58, 75, 91),
        const Radius.circular(10),
      ),
      muted,
    );
    canvas.drawRect(Rect.fromLTWH(size.width - 108, 73, 50, 48), light);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(128, 88, 57, 62),
        const Radius.circular(8),
      ),
      light,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ScanCorner extends StatelessWidget {
  const _ScanCorner({
    required this.label,
    required this.value,
    this.accent = _lime,
  });
  final String label;
  final String value;
  final Color accent;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    decoration: BoxDecoration(
      color: const Color(0xE81B2B22),
      border: Border.all(color: accent, width: 1.5),
      borderRadius: BorderRadius.circular(9),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: accent,
            fontSize: 9,
            fontWeight: FontWeight.w900,
            letterSpacing: .7,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    ),
  );
}

class CaptureScreen extends StatelessWidget {
  const CaptureScreen({super.key});

  Future<void> _pick(BuildContext context, ImageSource source) async {
    final image = await ImagePicker().pickImage(
      source: source,
      imageQuality: 82,
      maxWidth: 1800,
    );
    if (image == null || !context.mounted) return;
    final bytes = await image.readAsBytes();
    if (context.mounted) _analyze(context, bytes);
  }

  void _analyze(BuildContext context, [Uint8List? bytes]) =>
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => AnalyzingScreen(imageBytes: bytes)),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      backgroundColor: _cream,
      leading: const BackButton(),
      title: const Text(
        'Scan a space',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 10, 22, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  height: 225,
                  decoration: BoxDecoration(
                    color: _ink,
                    borderRadius: BorderRadius.circular(32),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const Icon(
                        Icons.chair_outlined,
                        color: Color(0xFF53665B),
                        size: 115,
                      ),
                      Positioned.fill(
                        child: Padding(
                          padding: const EdgeInsets.all(36),
                          child: CustomPaint(painter: _ViewfinderPainter()),
                        ),
                      ),
                      const Positioned(
                        bottom: 24,
                        child: Text(
                          'Fit one shelf or corner in frame',
                          style: TextStyle(
                            color: Colors.white70,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                Text(
                  'One wide photo works best',
                  style: Theme.of(context).textTheme.headlineLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  'Avoid faces, mail, keys, medication, or anything private. Estimates are not appraisals.',
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () => _pick(context, ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_rounded),
                  label: const Text('Open camera'),
                ),
                const SizedBox(height: 11),
                OutlinedButton.icon(
                  onPressed: () => _pick(context, ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Choose a photo'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(55),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                    side: const BorderSide(color: Color(0xFFCBD2CC)),
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => _analyze(context),
                  child: const Text(
                    'Try the demo room',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _ViewfinderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = _lime
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const l = 28.0;
    canvas.drawLine(Offset.zero, const Offset(l, 0), p);
    canvas.drawLine(Offset.zero, const Offset(0, l), p);
    canvas.drawLine(Offset(size.width, 0), Offset(size.width - l, 0), p);
    canvas.drawLine(Offset(size.width, 0), Offset(size.width, l), p);
    canvas.drawLine(Offset(0, size.height), Offset(l, size.height), p);
    canvas.drawLine(Offset(0, size.height), Offset(0, size.height - l), p);
    canvas.drawLine(
      Offset(size.width, size.height),
      Offset(size.width - l, size.height),
      p,
    );
    canvas.drawLine(
      Offset(size.width, size.height),
      Offset(size.width, size.height - l),
      p,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AnalyzingScreen extends StatefulWidget {
  const AnalyzingScreen({super.key, this.imageBytes});
  final Uint8List? imageBytes;
  @override
  State<AnalyzingScreen> createState() => _AnalyzingScreenState();
}

class _AnalyzingScreenState extends State<AnalyzingScreen> {
  static const _apiUrl = String.fromEnvironment('CLUTTERCASH_API_URL');

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    if (widget.imageBytes == null) {
      await Future<void>.delayed(const Duration(milliseconds: 1400));
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const ResultsScreen()),
        );
      }
      return;
    }

    final api = ScanApi(baseUrl: _apiUrl);
    if (!api.isConfigured) {
      await Future<void>.delayed(const Duration(milliseconds: 650));
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) =>
                LiveAnalysisSetupScreen(imageBytes: widget.imageBytes!),
          ),
        );
      }
      return;
    }

    try {
      final result = await api.analyze(widget.imageBytes!);
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) =>
                ResultsScreen(imageBytes: widget.imageBytes, result: result),
          ),
        );
      }
    } on Object catch (error) {
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => LiveAnalysisSetupScreen(
              imageBytes: widget.imageBytes!,
              error: error.toString(),
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 150,
                height: 150,
                decoration: BoxDecoration(
                  color: _ink,
                  borderRadius: BorderRadius.circular(38),
                ),
                child: const Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 88,
                      height: 88,
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        color: _lime,
                        backgroundColor: Color(0xFF31473A),
                      ),
                    ),
                    Icon(Icons.auto_awesome_rounded, color: _lime, size: 39),
                  ],
                ),
              ),
              const SizedBox(height: 30),
              Text(
                'Finding the good stuff…',
                style: Theme.of(context).textTheme.headlineLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                'Identifying items · checking value · ranking effort',
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class LiveAnalysisSetupScreen extends StatelessWidget {
  const LiveAnalysisSetupScreen({
    super.key,
    required this.imageBytes,
    this.error,
  });

  final Uint8List imageBytes;
  final String? error;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(backgroundColor: _cream, leading: const BackButton()),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 8, 22, 30),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: SizedBox(
                    height: 235,
                    child: Image.memory(imageBytes, fit: BoxFit.cover),
                  ),
                ),
                const SizedBox(height: 24),
                const _Eyebrow('YOUR PHOTO IS READY'),
                const SizedBox(height: 9),
                Text(
                  error == null
                      ? 'Connect live AI analysis'
                      : 'We couldn’t analyze this photo',
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 10),
                Text(
                  error == null
                      ? 'This build keeps provider keys off your phone. Start the included secure API and rebuild with its URL to analyze real photos.'
                      : 'Nothing was invented. Check the secure API connection, then try again. Your image stays on this screen only.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(13),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFE9DC),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      error!,
                      style: const TextStyle(
                        color: Color(0xFF7B3B19),
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ResultsScreen(imageBytes: imageBytes),
                    ),
                  ),
                  child: const Text('See a clearly labeled demo result'),
                ),
                const SizedBox(height: 9),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Choose another photo'),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Demo values do not describe your uploaded photo.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

ScanResult _demoResult() => ScanResult(
  id: 'demo-scan',
  projectId: 'garage-reset',
  createdAt: DateTime.now(),
  items: const [
    ClutterItem(
      id: 'camera',
      name: 'Vintage film camera',
      lowValue: 140,
      typicalValue: 190,
      highValue: 260,
      confidence: Confidence.high,
      effort: SaleEffort.medium,
      route: ItemRoute.sell,
      category: 'Cameras',
      reason: 'Strong demand. Verify model number before listing.',
      boxLeft: .08,
      boxTop: .14,
      boxWidth: .34,
      boxHeight: .34,
    ),
    ClutterItem(
      id: 'tools',
      name: 'Cordless tool set',
      lowValue: 75,
      typicalValue: 92,
      highValue: 110,
      confidence: Confidence.medium,
      effort: SaleEffort.low,
      route: ItemRoute.sell,
      category: 'Tools',
      reason: 'Fast local sale if charger and batteries work.',
      boxLeft: .56,
      boxTop: .18,
      boxWidth: .34,
      boxHeight: .32,
    ),
    ClutterItem(
      id: 'speaker',
      name: 'Bookshelf speakers',
      lowValue: 65,
      typicalValue: 83,
      highValue: 105,
      confidence: Confidence.medium,
      effort: SaleEffort.low,
      route: ItemRoute.sell,
      category: 'Audio',
      reason: 'Model label photo will improve confidence.',
      boxLeft: .13,
      boxTop: .58,
      boxWidth: .28,
      boxHeight: .28,
    ),
    ClutterItem(
      id: 'lamp',
      name: 'Brass desk lamp',
      lowValue: 35,
      typicalValue: 48,
      highValue: 50,
      confidence: Confidence.low,
      effort: SaleEffort.low,
      route: ItemRoute.bundle,
      category: 'Home',
      reason: 'Bundle with small décor for a faster clear-out.',
      boxLeft: .60,
      boxTop: .58,
      boxWidth: .24,
      boxHeight: .27,
    ),
    ClutterItem(
      id: 'books',
      name: 'Mixed hardcover books',
      lowValue: 0,
      typicalValue: 0,
      highValue: 0,
      confidence: Confidence.low,
      effort: SaleEffort.high,
      route: ItemRoute.donate,
      category: 'Books',
      reason: 'Likely not worth listing one by one.',
    ),
  ],
);

class ResultsScreen extends StatefulWidget {
  const ResultsScreen({super.key, this.imageBytes, this.result});
  final Uint8List? imageBytes;
  final ScanResult? result;
  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  late final ScanResult scan = widget.result ?? _demoResult();
  late final Set<String> queued = scan.items
      .where((item) => item.route == ItemRoute.sell)
      .take(3)
      .map((item) => item.id)
      .toSet();

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            backgroundColor: _cream,
            surfaceTintColor: _cream,
            leading: IconButton(
              icon: const Icon(Icons.close_rounded),
              onPressed: () =>
                  Navigator.popUntil(context, (route) => route.isFirst),
            ),
            title: const Text(
              'Garage reset',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
            actions: [
              IconButton(
                onPressed: () => _shareCard(context),
                icon: const Icon(Icons.ios_share_rounded),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 34),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _ResultHero(
                        scan: scan,
                        imageBytes: widget.imageBytes,
                        isDemo: widget.result == null,
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          Expanded(
                            child: _MetricCard(
                              icon: Icons.inventory_2_outlined,
                              value: '${scan.items.length}',
                              label: 'items found',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _MetricCard(
                              icon: Icons.timer_outlined,
                              value: '38 min',
                              label: 'listing effort',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _MetricCard(
                              icon: Icons.chair_outlined,
                              value: '12 ft²',
                              label: 'space to clear',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Your action queue',
                              style: Theme.of(context).textTheme.headlineMedium,
                            ),
                          ),
                          Text(
                            '${queued.length} selected',
                            style: const TextStyle(
                              color: _forest,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Highest likely cash with the least hassle—first.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 13),
                      ...scan.items.map(
                        (item) => _ItemCard(
                          item: item,
                          selected: queued.contains(item.id),
                          onChanged: () => setState(
                            () => queued.contains(item.id)
                                ? queued.remove(item.id)
                                : queued.add(item.id),
                          ),
                          onTap: () => _showItem(context, item),
                        ),
                      ),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: queued.isEmpty
                            ? null
                            : () => _showProjectCreated(context),
                        icon: const Icon(Icons.rocket_launch_rounded),
                        label: Text('Start clearing ${queued.length} items'),
                      ),
                      const SizedBox(height: 11),
                      OutlinedButton(
                        onPressed: () => _showPaywall(context),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(54),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        child: const Text(
                          'Unlock full project · 7 days free',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const _TrustNote(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );

  void _showItem(
    BuildContext context,
    ClutterItem item,
  ) => showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: _paper,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (context) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .74,
      minChildSize: .5,
      maxChildSize: .92,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(22, 12, 22, 30),
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFD5D9D5),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              if (item.typicalValue >= 100)
                const _Pill(text: 'BIG TICKET', color: _orange),
              const Spacer(),
              _ConfidenceChip(item.confidence),
            ],
          ),
          const SizedBox(height: 13),
          Text(item.name, style: Theme.of(context).textTheme.headlineLarge),
          const SizedBox(height: 8),
          Text(
            r'$${item.lowValue.toInt()}–$${item.highValue.toInt()} likely resale',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: _forest,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'Expected net about \$${item.expectedNet.toStringAsFixed(0)} after typical fees and effort.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 22),
          _InfoBlock(
            icon: Icons.lightbulb_outline_rounded,
            title: 'Why it ranked here',
            body: item.reason,
          ),
          const SizedBox(height: 12),
          const _InfoBlock(
            icon: Icons.photo_camera_back_outlined,
            title: 'Get a better estimate',
            body:
                'Add a close photo of the model number, label, damage, and included accessories.',
          ),
          const SizedBox(height: 22),
          FilledButton.icon(
            onPressed: () {
              Clipboard.setData(
                ClipboardData(
                  text:
                      '${item.name} in good used condition. See photos for details. Local pickup available.',
                ),
              );
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Listing draft copied')),
              );
            },
            icon: const Icon(Icons.copy_all_rounded),
            label: const Text('Copy listing draft'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('I need to correct this item'),
          ),
        ],
      ),
    ),
  );

  Future<void> _showProjectCreated(BuildContext context) async {
    var project = CleanoutProject.empty(
      id: 'project-${DateTime.now().millisecondsSinceEpoch}',
      name: 'Garage Reset',
    );
    for (final item in scan.items.where((item) => queued.contains(item.id))) {
      project = project.addItem(item.copyWith(status: ItemStatus.sell));
    }
    final preferences = await SharedPreferences.getInstance();
    final store = ProjectStore(preferences);
    await store.save(project);
    if (context.mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ProjectBoardScreen(project: project, store: store),
        ),
      );
    }
  }

  void _showPaywall(BuildContext context) => showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: _ink,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
    ),
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, color: Colors.white70),
              ),
            ),
            const Icon(Icons.auto_awesome_rounded, color: _lime, size: 46),
            const SizedBox(height: 12),
            const Text(
              'Clear the whole room.',
              style: TextStyle(
                color: Colors.white,
                fontSize: 31,
                fontWeight: FontWeight.w900,
                letterSpacing: -1,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Unlimited projects, complete item breakdowns, listing drafts, earnings, and household sharing.',
              style: TextStyle(color: Colors.white70, height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF263A2E),
                border: Border.all(color: _lime, width: 1.5),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'YEARLY · BEST VALUE',
                        style: TextStyle(
                          color: _lime,
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        r'$49.99/year',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  Spacer(),
                  Text(
                    r'$0.96/week',
                    style: TextStyle(
                      color: Colors.white70,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              r'Or $8.99 monthly · cancel anytime',
              style: TextStyle(color: Colors.white54),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Store billing connects before launch'),
                ),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: _lime,
                foregroundColor: _ink,
              ),
              child: const Text('Start 7-day free trial'),
            ),
            const SizedBox(height: 9),
            const Text(
              'Renews yearly after trial. Restore and cancellation will be available through your app-store account.',
              style: TextStyle(
                color: Colors.white38,
                fontSize: 11,
                height: 1.35,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );

  void _shareCard(BuildContext context) =>
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Progress card ready after your first completed item'),
        ),
      );
}

class _ResultHero extends StatelessWidget {
  const _ResultHero({
    required this.scan,
    this.imageBytes,
    required this.isDemo,
  });
  final ScanResult scan;
  final Uint8List? imageBytes;
  final bool isDemo;
  @override
  Widget build(BuildContext context) => Container(
    height: 350,
    decoration: BoxDecoration(
      color: _ink,
      borderRadius: BorderRadius.circular(28),
    ),
    clipBehavior: Clip.antiAlias,
    child: Stack(
      children: [
        if (imageBytes != null)
          Positioned.fill(
            child: Opacity(
              opacity: .42,
              child: Image.memory(imageBytes!, fit: BoxFit.cover),
            ),
          )
        else
          const Positioned.fill(child: CustomPaint(painter: _ClutterPainter())),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, _ink.withValues(alpha: .25), _ink],
              ),
            ),
          ),
        ),
        Positioned(
          left: 17,
          top: 17,
          child: Row(
            children: [
              _Pill(text: '${scan.items.length} ITEMS FOUND', color: _lime),
              const SizedBox(width: 7),
              if (scan.bigTicketItems().isNotEmpty)
                const _Pill(text: 'BIG TICKET', color: _orange),
              if (isDemo) ...[
                const SizedBox(width: 7),
                const _Pill(text: 'DEMO', color: _forest),
              ],
            ],
          ),
        ),
        if (scan.items.isNotEmpty)
          Positioned(
            left: 17,
            top: 69,
            child: _ScanCorner(
              label: scan.items.first.name.toUpperCase(),
              value:
                  '\$${scan.items.first.lowValue.toInt()}–\$${scan.items.first.highValue.toInt()}',
            ),
          ),
        if (scan.items.length > 1)
          Positioned(
            right: 17,
            top: 137,
            child: _ScanCorner(
              label: scan.items[1].name.toUpperCase(),
              value:
                  '\$${scan.items[1].lowValue.toInt()}–\$${scan.items[1].highValue.toInt()}',
              accent: _orange,
            ),
          ),
        Positioned(
          left: 20,
          right: 20,
          bottom: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Cash hiding here',
                style: TextStyle(
                  color: Colors.white70,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '\$${scan.lowTotal.toInt()}–\$${scan.highTotal.toInt()}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 42,
                  height: 1,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -1.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Best guess—not an appraisal. Verify high-value items before selling.',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({
    required this.item,
    required this.selected,
    required this.onChanged,
    required this.onTap,
  });
  final ClutterItem item;
  final bool selected;
  final VoidCallback onChanged;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Row(
          children: [
            GestureDetector(
              onTap: onChanged,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: selected ? _forest : Colors.transparent,
                  border: Border.all(
                    color: selected ? _forest : const Color(0xFFC5CCC6),
                    width: 2,
                  ),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: selected
                    ? const Icon(
                        Icons.check_rounded,
                        size: 19,
                        color: Colors.white,
                      )
                    : null,
              ),
            ),
            const SizedBox(width: 13),
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFE9EEE9),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(_categoryIcon(item.category), color: _forest),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          item.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            color: _ink,
                          ),
                        ),
                      ),
                      if (item.typicalValue >= 100) ...[
                        const SizedBox(width: 7),
                        const _Pill(text: 'BIG TICKET', color: _orange),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${_routeLabel(item.route)} · ${_effortLabel(item.effort)} effort',
                    style: const TextStyle(
                      color: _muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '\$${item.lowValue.toInt()}–\$${item.highValue.toInt()}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    color: _forest,
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFFA7B0A9),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

IconData _categoryIcon(String category) => switch (category) {
  'Cameras' => Icons.camera_alt_outlined,
  'Tools' => Icons.handyman_outlined,
  'Audio' => Icons.speaker_outlined,
  'Books' => Icons.menu_book_outlined,
  _ => Icons.light_outlined,
};
String _routeLabel(ItemRoute route) => switch (route) {
  ItemRoute.sell => 'SELL',
  ItemRoute.bundle => 'BUNDLE',
  ItemRoute.donate => 'DONATE',
  ItemRoute.recycle => 'RECYCLE',
  ItemRoute.keep => 'KEEP',
};
String _effortLabel(SaleEffort effort) => switch (effort) {
  SaleEffort.low => 'Low',
  SaleEffort.medium => 'Medium',
  SaleEffort.high => 'High',
};

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.icon,
    required this.value,
    required this.label,
  });
  final IconData icon;
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 10),
    decoration: BoxDecoration(
      color: _paper,
      borderRadius: BorderRadius.circular(19),
    ),
    child: Column(
      children: [
        Icon(icon, color: _forest, size: 21),
        const SizedBox(height: 7),
        Text(
          value,
          style: const TextStyle(
            color: _ink,
            fontWeight: FontWeight.w900,
            fontSize: 16,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: _muted,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}

class _TinyFeature extends StatelessWidget {
  const _TinyFeature({
    required this.icon,
    required this.title,
    required this.caption,
  });
  final IconData icon;
  final String title;
  final String caption;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 7),
    decoration: BoxDecoration(
      color: _paper,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      children: [
        Icon(icon, color: _forest, size: 22),
        const SizedBox(height: 7),
        Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w900,
            color: _ink,
            fontSize: 12,
          ),
          textAlign: TextAlign.center,
        ),
        Text(
          caption,
          style: const TextStyle(color: _muted, fontSize: 10),
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 11,
      color: _forest,
      fontWeight: FontWeight.w900,
      letterSpacing: 1.5,
    ),
  );
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.color});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(30),
    ),
    child: Text(
      text,
      style: TextStyle(
        color: color == _lime || color == _orange ? _ink : Colors.white,
        fontSize: 9,
        fontWeight: FontWeight.w900,
        letterSpacing: .7,
      ),
    ),
  );
}

class _ConfidenceChip extends StatelessWidget {
  const _ConfidenceChip(this.confidence);
  final Confidence confidence;
  @override
  Widget build(BuildContext context) => Text(
    '${confidence.name.toUpperCase()} CONFIDENCE',
    style: const TextStyle(
      color: _muted,
      fontSize: 11,
      fontWeight: FontWeight.w800,
    ),
  );
}

class _InfoBlock extends StatelessWidget {
  const _InfoBlock({
    required this.icon,
    required this.title,
    required this.body,
  });
  final IconData icon;
  final String title;
  final String body;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _cream,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: _forest),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  color: _ink,
                ),
              ),
              const SizedBox(height: 4),
              Text(body, style: const TextStyle(color: _muted, height: 1.4)),
            ],
          ),
        ),
      ],
    ),
  );
}

class _TrustNote extends StatelessWidget {
  const _TrustNote();
  @override
  Widget build(BuildContext context) => const Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(Icons.verified_user_outlined, size: 19, color: _muted),
      SizedBox(width: 9),
      Expanded(
        child: Text(
          'Your room may contain private details. Production image analysis will use short retention, deletion controls, and no model training without explicit permission.',
          style: TextStyle(color: _muted, fontSize: 11, height: 1.45),
        ),
      ),
    ],
  );
}

class ProjectBoardScreen extends StatefulWidget {
  const ProjectBoardScreen({super.key, required this.project, this.store});
  final CleanoutProject project;
  final ProjectStore? store;

  @override
  State<ProjectBoardScreen> createState() => _ProjectBoardScreenState();
}

class _ProjectBoardScreenState extends State<ProjectBoardScreen> {
  late CleanoutProject project = widget.project;

  Future<void> _change(ClutterItem item, ItemStatus status) async {
    setState(() {
      project = status == ItemStatus.sold
          ? project.recordSale(
              item.id,
              soldPrice: item.typicalValue,
              fees: item.typicalValue * .10,
            )
          : project.updateStatus(item.id, status);
    });
    await widget.store?.save(project);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      backgroundColor: _cream,
      title: Text(
        project.name,
        style: const TextStyle(fontWeight: FontWeight.w900),
      ),
      actions: [
        IconButton(
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Progress card will include your cleared space and real earnings.',
              ),
            ),
          ),
          icon: const Icon(Icons.ios_share_rounded),
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
            children: [
              Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: _ink,
                  borderRadius: BorderRadius.circular(26),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _EyebrowLight('CASH SPRINT'),
                    const SizedBox(height: 7),
                    Text(
                      '\$${project.realizedEarnings.toStringAsFixed(0)} earned',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${project.clearedCount} of ${project.items.length} cleared',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: project.progress,
                        minHeight: 9,
                        color: _lime,
                        backgroundColor: const Color(0xFF385043),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 23),
              Text(
                'Do the easiest win first',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Update each item as you clear it. Earnings use the sale price minus estimated fees.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 14),
              ...project.items.map(
                (item) => Card(
                  margin: const EdgeInsets.only(bottom: 11),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: const Color(0xFFE9EEE9),
                                borderRadius: BorderRadius.circular(13),
                              ),
                              child: Icon(
                                _categoryIcon(item.category),
                                color: _forest,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    style: const TextStyle(
                                      color: _ink,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  Text(
                                    '\$${item.lowValue.toInt()}–\$${item.highValue.toInt()} estimate',
                                    style: const TextStyle(
                                      color: _muted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            _StatusPill(item.status),
                          ],
                        ),
                        const SizedBox(height: 13),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () =>
                                    _change(item, ItemStatus.listed),
                                child: const Text('Listed'),
                              ),
                            ),
                            const SizedBox(width: 7),
                            Expanded(
                              child: FilledButton(
                                onPressed: () => _change(item, ItemStatus.sold),
                                style: FilledButton.styleFrom(
                                  minimumSize: const Size(0, 42),
                                  backgroundColor: _forest,
                                ),
                                child: const Text('Sold'),
                              ),
                            ),
                            const SizedBox(width: 7),
                            Expanded(
                              child: TextButton(
                                onPressed: () =>
                                    _change(item, ItemStatus.donated),
                                child: const Text('Donate'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const _InfoBlock(
                icon: Icons.tips_and_updates_outlined,
                title: 'Next best move',
                body:
                    'List the highest-value item first. If it has no interest in seven days, lower the price or donate it so clutter does not become inventory.',
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _EyebrowLight extends StatelessWidget {
  const _EyebrowLight(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      color: _lime,
      fontSize: 11,
      fontWeight: FontWeight.w900,
      letterSpacing: 1.4,
    ),
  );
}

class _StatusPill extends StatelessWidget {
  const _StatusPill(this.status);
  final ItemStatus status;
  @override
  Widget build(BuildContext context) {
    final done =
        status == ItemStatus.sold ||
        status == ItemStatus.donated ||
        status == ItemStatus.recycled;
    final label = switch (status) {
      ItemStatus.unreviewed => 'NEW',
      ItemStatus.sell => 'TO SELL',
      ItemStatus.listed => 'LISTED',
      ItemStatus.sold => 'SOLD',
      ItemStatus.donated => 'DONATED',
      ItemStatus.recycled => 'RECYCLED',
      ItemStatus.keep => 'KEEP',
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: done ? _lime : const Color(0xFFE9EEE9),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: _ink,
          fontSize: 9,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
