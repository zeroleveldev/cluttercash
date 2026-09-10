import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'domain/item.dart';
import 'domain/listing_guide.dart';
import 'domain/project.dart';
import 'domain/scan_result.dart';
import 'services/beta_access_api.dart';
import 'services/beta_access_state.dart';
import 'services/free_use_token.dart';
import 'services/marketplace_link.dart';
import 'services/project_store.dart';
import 'services/scan_api.dart';
import 'services/telemetry.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  const telemetry = TelemetryClient(baseUrl: _apiUrl, inviteCode: _betaInvite);
  installTelemetryErrorHandlers(telemetry);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const ClutterCashApp(telemetry: telemetry));
}

const _ink = Color(0xFF14231B);
const _forest = Color(0xFF1F4D36);
const _lime = Color(0xFFB9F26B);
const _cream = Color(0xFFF7F4EA);
const _paper = Color(0xFFFFFDF7);
const _muted = Color(0xFF637067);
const _orange = Color(0xFFFFA655);
const _apiUrl = String.fromEnvironment('CLUTTERCASH_API_URL');
const _betaInvite = String.fromEnvironment('CLUTTERCASH_BETA_INVITE');
const _betaInviteStorageKey = 'cluttercash.betaInviteCode';

Future<String> _activeInviteCode() async {
  if (_betaInvite.trim().isNotEmpty) return _betaInvite.trim();
  return (await SharedPreferences.getInstance())
          .getString(_betaInviteStorageKey)
          ?.trim() ??
      '';
}

Future<ScanApi> _activeScanApi() async {
  final preferences = await SharedPreferences.getInstance();
  return ScanApi(
    baseUrl: _apiUrl,
    inviteCode: await _activeInviteCode(),
    deviceToken: await getOrCreateFreeUseToken(preferences),
  );
}

class ClutterCashApp extends StatelessWidget {
  const ClutterCashApp({
    super.key,
    this.telemetry = const TelemetryClient(
      baseUrl: _apiUrl,
      inviteCode: _betaInvite,
    ),
  });

  final TelemetryReporter telemetry;

  @override
  Widget build(BuildContext context) => TelemetryScope(
    reporter: telemetry,
    child: MaterialApp(
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
            textStyle: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
          ),
        ),
        cardTheme: CardThemeData(
          color: _paper,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
        ),
      ),
      home: const WelcomeScreen(),
    ),
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
                TextButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const BetaInviteRequestScreen(),
                    ),
                  ),
                  icon: const Icon(Icons.mark_email_unread_outlined),
                  label: const Text('Need more scans? Request access'),
                ),
                TextButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const ProjectLibraryScreen(),
                    ),
                  ),
                  icon: const Icon(Icons.folder_open_outlined),
                  label: const Text('Open saved projects'),
                ),
                TextButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const BetaTermsScreen()),
                  ),
                  icon: const Icon(Icons.privacy_tip_outlined),
                  label: const Text('Privacy & beta terms'),
                ),
                const SizedBox(height: 4),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.lock_outline_rounded, size: 16, color: _muted),
                    SizedBox(width: 7),
                    Flexible(
                      child: Text(
                        'No account or code needed for 3 free analyses',
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
                        title: 'Potential value',
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

class BetaTermsScreen extends StatelessWidget {
  const BetaTermsScreen({super.key});

  static const supportEmail = 'cluttercash.help@gmail.com';

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      backgroundColor: _cream,
      title: const Text('Privacy & beta terms'),
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(22, 16, 22, 32),
            children: const [
              Text(
                'Free beta',
                style: TextStyle(
                  color: _forest,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.1,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Your beta privacy',
                style: TextStyle(
                  color: _ink,
                  fontWeight: FontWeight.w900,
                  fontSize: 30,
                  height: 1.05,
                ),
              ),
              SizedBox(height: 10),
              Text(
                'Effective September 10, 2026. This free beta allows three no-registration analyses per browser/device, followed by optional manually approved access in that same browser. Existing invite codes remain supported. There are no subscriptions, scan packs, payments, or in-app purchases.',
                style: TextStyle(color: _muted, height: 1.45),
              ),
              SizedBox(height: 22),
              _TermsSection(
                title: 'What this app is—and is not',
                body:
                    'ClutterCash helps you identify visible items that may be worth selling and provides potential selling-value ranges and marketplace research links. It is not an appraisal, authentication service, marketplace, financial advisor, transaction tracker, listing tool, or guarantee of a sale. Verify model, condition, accessories, price, and marketplace rules before posting.',
              ),
              _TermsSection(
                title: 'Photos and AI processing',
                body:
                    'When you choose a live scan or model-label photo and accept the upload notice, the app sends the image through ClutterCash’s Cloudflare Worker to Google Gemini. The Worker processes image bytes in memory and is designed not to write them to disk. Google may review free-tier submissions and use them to improve its products. Never upload faces, mail, addresses, keys, medication, documents, account information, or other sensitive/private content.',
              ),
              _TermsSection(
                title: 'Your data and local storage',
                body:
                    'This beta has no account or cloud project sync. Projects, results, corrections, and item statuses stay in local app/browser storage on this device. The app creates one random local token to enforce three no-registration analyses. If you are approved, the Worker promotes that token’s hash to continued limited access. Plaintext browser tokens are not stored server-side. These are cost/abuse controls, not a user account or advertising profile.',
              ),
              _TermsSection(
                title: 'Access requests',
                body:
                    'An access request sends your email and optional first name/device description to the owner’s private Discord alert. Plaintext contact fields are not stored in the Worker’s Durable Object. Hashed browser, status, and approval tokens are kept for up to seven days while pending. After approval, a private hashed status record remains for up to 30 days so this browser can show that access is active. Clearing site storage or switching browsers can break that link.',
              ),
              _TermsSection(
                title: 'Minimal beta diagnostics',
                body:
                    'An invited build sends only allow-listed event names for scan progress, local project creation or reopening, item corrections or status updates, and coarse app-crash categories to ClutterCash Worker logs. These events do not include photos, item or project names, values, invite codes or hashes, error text, or device/account IDs. Delivery is best-effort. Cloudflare and network providers may process standard connection data under their own policies.',
              ),
              _TermsSection(
                title: 'Delete your data',
                body:
                    'Use Saved projects to delete one project or all local projects. You can also uninstall the app or clear this site/app’s storage. These actions cannot be undone. ClutterCash does not provide cloud image storage or a provider-deletion tool; Google’s handling of uploaded photos is governed by Google’s policies.',
              ),
              _TermsSection(
                title: 'Your responsibility',
                body:
                    'Use the beta only if you are at least 18 and have permission to photograph the space and items. Marketplace searches are user-facing links, not scraped price data or direct posting. Verify the item and price yourself and follow each marketplace’s rules, fees, taxes, safety guidance, and terms.',
              ),
              _TermsSection(
                title: 'Support and feedback',
                body:
                    'For beta support, feedback, privacy questions, or help deleting local data, email the support inbox below. Do not email sensitive photos, serial numbers, passwords, account information, or payment details.',
              ),
              Text(
                supportEmail,
                style: TextStyle(
                  color: _forest,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
              SizedBox(height: 12),
              Text(
                'Full notice: docs/BETA_PRIVACY_AND_TERMS.md',
                style: TextStyle(color: _muted, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _TermsSection extends StatelessWidget {
  const _TermsSection({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: _ink,
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 5),
        Text(body, style: const TextStyle(color: _muted, height: 1.45)),
      ],
    ),
  );
}

class ProjectLibraryScreen extends StatefulWidget {
  const ProjectLibraryScreen({super.key, this.store});

  final ProjectStore? store;

  @override
  State<ProjectLibraryScreen> createState() => _ProjectLibraryScreenState();
}

class _ProjectLibraryScreenState extends State<ProjectLibraryScreen> {
  ProjectStore? store;
  List<CleanoutProject> projects = const [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    final nextStore =
        widget.store ?? ProjectStore(await SharedPreferences.getInstance());
    final nextProjects = await nextStore.loadAll();
    if (!mounted) return;
    setState(() {
      store = nextStore;
      projects = nextProjects;
      loading = false;
    });
  }

  Future<void> _openProject(CleanoutProject project) async {
    final projectStore = store;
    if (projectStore == null) return;
    unawaited(
      TelemetryScope.of(context).record(TelemetryEvent.projectReopened),
    );
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            ProjectBoardScreen(project: project, store: projectStore),
      ),
    );
    await _loadProjects();
  }

  Future<void> _deleteProject(CleanoutProject project) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete project?'),
        content: Text(
          'Delete “${project.name}” from this device? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete project'),
          ),
        ],
      ),
    );
    if (confirmed != true || store == null) return;
    await store!.delete(project.id);
    await _loadProjects();
  }

  Future<void> _deleteAllProjects() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete all saved projects?'),
        content: const Text(
          'Delete every saved ClutterCash project from this device? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete all'),
          ),
        ],
      ),
    );
    if (confirmed != true || store == null) return;
    await Future.wait(projects.map((project) => store!.delete(project.id)));
    await _loadProjects();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      backgroundColor: _cream,
      title: const Text(
        'Your projects',
        style: TextStyle(fontWeight: FontWeight.w900),
      ),
      actions: [
        if (projects.isNotEmpty)
          IconButton(
            tooltip: 'Delete all projects',
            onPressed: _deleteAllProjects,
            icon: const Icon(Icons.delete_sweep_outlined),
          ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : projects.isEmpty
              ? const _EmptyProjectLibrary()
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 30),
                  itemCount: projects.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, index) {
                    final project = projects[index];
                    final itemCount = project.items.length;
                    return Card(
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 10,
                        ),
                        leading: const CircleAvatar(
                          backgroundColor: Color(0xFFE9EEE9),
                          foregroundColor: _forest,
                          child: Icon(Icons.inventory_2_outlined),
                        ),
                        title: Text(
                          project.name,
                          style: const TextStyle(
                            color: _ink,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        subtitle: Text(
                          '$itemCount ${itemCount == 1 ? 'item' : 'items'} · ${project.clearedCount} cleared',
                        ),
                        onTap: () => _openProject(project),
                        trailing: IconButton(
                          tooltip: 'Delete ${project.name}',
                          onPressed: () => _deleteProject(project),
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    ),
  );
}

class _EmptyProjectLibrary extends StatelessWidget {
  const _EmptyProjectLibrary();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.all(32),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.folder_open_outlined, size: 48, color: _forest),
        SizedBox(height: 14),
        Text(
          'No saved projects yet',
          style: TextStyle(
            color: _ink,
            fontSize: 22,
            fontWeight: FontWeight.w900,
          ),
        ),
        SizedBox(height: 8),
        Text(
          'Start a scan, choose items to clear, and your project will stay on this device.',
          textAlign: TextAlign.center,
          style: TextStyle(color: _muted, height: 1.4),
        ),
      ],
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
    if (!context.mounted) return;
    final accepted = await _confirmFreeBeta(context);
    if (accepted && context.mounted) _analyze(context, bytes);
  }

  Future<bool> _confirmFreeBeta(BuildContext context) async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Free AI beta privacy'),
            content: const Text(
              'Only upload a staged, non-sensitive photo. Do not include faces, mail, addresses, keys, medication, documents, or private belongings. Google may review free-tier AI submissions and use them to improve its products.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const BetaTermsScreen()),
                ),
                child: const Text('Privacy & beta terms'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('I understand'),
              ),
            ],
          ),
        ) ??
        false;
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
  const AnalyzingScreen({super.key, this.imageBytes, this.analyze});
  final Uint8List? imageBytes;
  final Future<ScanResult> Function(Uint8List)? analyze;
  @override
  State<AnalyzingScreen> createState() => _AnalyzingScreenState();
}

class _AnalyzingScreenState extends State<AnalyzingScreen> {
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

    final Future<ScanResult> Function(Uint8List) analyze;
    if (widget.analyze case final injected?) {
      analyze = injected;
    } else {
      final api = await _activeScanApi();
      if (!mounted) return;
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
      analyze = api.analyze;
    }

    final telemetry = TelemetryScope.read(context);
    unawaited(telemetry.record(TelemetryEvent.scanStarted));

    try {
      final result = await analyze(widget.imageBytes!);
      unawaited(telemetry.record(TelemetryEvent.scanSucceeded));
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
      unawaited(
        telemetry.record(
          TelemetryEvent.scanFailed,
          failure: error is ScanApiException
              ? TelemetryFailure.api
              : TelemetryFailure.unknown,
        ),
      );
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

class BetaInviteCodeScreen extends StatefulWidget {
  const BetaInviteCodeScreen({super.key, this.onSaved});

  final VoidCallback? onSaved;

  @override
  State<BetaInviteCodeScreen> createState() => _BetaInviteCodeScreenState();
}

class _BetaInviteCodeScreenState extends State<BetaInviteCodeScreen> {
  final controller = TextEditingController();
  String? message;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final code = controller.text.trim();
    if (code.length < 8) {
      setState(() => message = 'Enter the beta code you received.');
      return;
    }
    await (await SharedPreferences.getInstance()).setString(
      _betaInviteStorageKey,
      code,
    );
    if (!mounted) return;
    setState(() => message = 'Beta code saved on this device');
    widget.onSaved?.call();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(backgroundColor: _cream, leading: const BackButton()),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const _Eyebrow('INVITED BETA'),
                const SizedBox(height: 10),
                Text(
                  'Enter your beta code',
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Your code allows a small number of live analyses. It is saved only on this device and is not your Gemini or account password.',
                  style: TextStyle(color: _muted, height: 1.4),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: controller,
                  autocorrect: false,
                  enableSuggestions: false,
                  textCapitalization: TextCapitalization.none,
                  decoration: const InputDecoration(
                    labelText: 'Beta invite code',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: _save,
                  child: const Text('Save beta code'),
                ),
                TextButton(
                  onPressed: () => Navigator.push<void>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const BetaInviteRequestScreen(),
                    ),
                  ),
                  child: const Text('Request beta access'),
                ),
                if (message != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    message!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: _forest,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

typedef BetaAccessSubmitter =
    Future<BetaAccessReceipt> Function({
      required String email,
      required String name,
      required String device,
    });
typedef BetaAccessStatusChecker =
    Future<BetaAccessStatus> Function(BetaAccessReceipt receipt);

class BetaInviteRequestScreen extends StatefulWidget {
  const BetaInviteRequestScreen({
    super.key,
    this.requestAccess,
    this.checkStatus,
  });

  final BetaAccessSubmitter? requestAccess;
  final BetaAccessStatusChecker? checkStatus;

  @override
  State<BetaInviteRequestScreen> createState() =>
      _BetaInviteRequestScreenState();
}

class _BetaInviteRequestScreenState extends State<BetaInviteRequestScreen> {
  final email = TextEditingController();
  final name = TextEditingController();
  final device = TextEditingController();
  bool submitting = false;
  bool sent = false;
  bool checking = false;
  bool approved = false;
  BetaAccessReceipt? receipt;
  String? message;

  @override
  void initState() {
    super.initState();
    unawaited(_loadSavedRequest());
  }

  Future<void> _loadSavedRequest() async {
    final saved = loadBetaAccessReceipt(await SharedPreferences.getInstance());
    if (!mounted || saved == null) return;
    setState(() {
      receipt = saved;
      sent = true;
    });
    await _checkStatus();
  }

  Future<BetaAccessReceipt> _requestAccess({
    required String email,
    required String name,
    required String device,
  }) async {
    final preferences = await SharedPreferences.getInstance();
    final deviceToken = await getOrCreateFreeUseToken(preferences);
    return const BetaAccessApi(baseUrl: _apiUrl).requestAccess(
      email: email,
      name: name,
      device: device,
      deviceToken: deviceToken,
    );
  }

  Future<void> _checkStatus() async {
    final activeReceipt = receipt;
    if (activeReceipt == null || checking) return;
    setState(() {
      checking = true;
      message = null;
    });
    try {
      final status =
          await (widget.checkStatus ??
              const BetaAccessApi(baseUrl: _apiUrl).checkStatus)(activeReceipt);
      if (!mounted) return;
      setState(() {
        checking = false;
        approved = status == BetaAccessStatus.approved;
      });
    } on BetaAccessApiException catch (error) {
      if (!mounted) return;
      setState(() {
        checking = false;
        message = error.message;
      });
    }
  }

  @override
  void dispose() {
    email.dispose();
    name.dispose();
    device.dispose();
    super.dispose();
  }

  Future<void> _startNewRequest() async {
    final preferences = await SharedPreferences.getInstance();
    await clearBetaAccessReceipt(preferences);
    if (!mounted) return;
    setState(() {
      sent = false;
      approved = false;
      receipt = null;
      message = null;
    });
  }

  Future<void> _submitRequest() async {
    final address = email.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(address)) {
      setState(() => message = 'Enter a valid email address.');
      return;
    }
    setState(() {
      submitting = true;
      message = null;
    });
    try {
      final submit = widget.requestAccess ?? _requestAccess;
      final submittedReceipt = await submit(
        email: address,
        name: name.text.trim(),
        device: device.text.trim(),
      );
      await saveBetaAccessReceipt(
        await SharedPreferences.getInstance(),
        submittedReceipt,
      );
      if (!mounted) return;
      setState(() {
        submitting = false;
        sent = true;
        receipt = submittedReceipt;
        approved = false;
      });
    } on BetaAccessApiException catch (error) {
      if (!mounted) return;
      setState(() {
        submitting = false;
        message = error.message;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        submitting = false;
        message = 'The request could not be sent. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(backgroundColor: _cream, leading: const BackButton()),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: sent
                ? Column(
                    children: [
                      Icon(
                        approved
                            ? Icons.verified_user_outlined
                            : Icons.hourglass_top_rounded,
                        color: _forest,
                        size: 64,
                      ),
                      const SizedBox(height: 18),
                      Text(
                        approved ? 'Access active' : 'Request sent',
                        style: Theme.of(context).textTheme.headlineLarge,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        approved
                            ? 'Continued beta access is active in this browser. No code or email is needed.'
                            : 'We will review your request. If approved, access activates privately in this browser.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: _muted, height: 1.4),
                      ),
                      if (!approved) ...[
                        const SizedBox(height: 18),
                        FilledButton.icon(
                          onPressed: checking ? null : _checkStatus,
                          icon: checking
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.refresh_rounded),
                          label: Text(
                            checking ? 'Checking…' : 'Check approval status',
                          ),
                        ),
                      ],
                      if (message != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          message!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.redAccent),
                        ),
                        if (!approved)
                          TextButton(
                            onPressed: _startNewRequest,
                            child: const Text('Start a new request'),
                          ),
                      ],
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _Eyebrow('LIMITED FREE BETA'),
                      const SizedBox(height: 10),
                      Text(
                        'Request continued access',
                        style: Theme.of(context).textTheme.headlineLarge,
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Enter your email and request access. The owner receives a private alert and reviews every request. Approval activates continued access in this browser—no code or email delivery needed.',
                        style: TextStyle(color: _muted, height: 1.4),
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        controller: email,
                        keyboardType: TextInputType.emailAddress,
                        textCapitalization: TextCapitalization.none,
                        autocorrect: false,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          labelText: 'Email address',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: name,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          labelText: 'First name (optional)',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: device,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Device or browser (optional)',
                          hintText: 'Android phone, iPhone, Chrome…',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: submitting ? null : _submitRequest,
                        icon: submitting
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.send_outlined),
                        label: Text(
                          submitting ? 'Sending request…' : 'Request access',
                        ),
                      ),
                      if (message != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          message!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.redAccent,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                      const Text(
                        'Your email is used only to review this beta request. Approval is delivered privately in this browser. Need help? cluttercash.help@gmail.com',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: _muted),
                      ),
                    ],
                  ),
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
                  onPressed: () => Navigator.push<void>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => BetaInviteCodeScreen(
                        onSaved: () => Navigator.of(context).pushReplacement(
                          MaterialPageRoute(
                            builder: (_) =>
                                AnalyzingScreen(imageBytes: imageBytes),
                          ),
                        ),
                      ),
                    ),
                  ),
                  child: const Text('Enter beta invite code'),
                ),
                const SizedBox(height: 9),
                OutlinedButton(
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
      searchQuery: 'vintage 35mm film camera body',
      marketplace: Marketplace.ebay,
      marketplaceReason:
          'eBay reaches camera collectors and makes model-by-model comparisons easier.',
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
  late ScanResult scan = widget.result ?? _demoResult();
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
            actions: const [],
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
                              icon: Icons.sell_outlined,
                              value:
                                  '\$${scan.lowTotal.toInt()}–\$${scan.highTotal.toInt()}',
                              label: 'potential range',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _MetricCard(
                              icon: Icons.checklist_rounded,
                              value: '${queued.length}',
                              label: 'selected to list',
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
                        'Highest potential value with the least hassle—first.',
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

  void _showItem(BuildContext context, ClutterItem item) =>
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: _paper,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        builder: (_) => _ItemDetailsSheet(
          item: item,
          onUpdated: (updated) => setState(() {
            scan = ScanResult(
              id: scan.id,
              projectId: scan.projectId,
              createdAt: scan.createdAt,
              items: scan.items
                  .map(
                    (existing) =>
                        existing.id == updated.id ? updated : existing,
                  )
                  .toList(),
            );
          }),
        ),
      );

  Future<void> _showProjectCreated(BuildContext context) async {
    final telemetry = TelemetryScope.of(context);
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
    unawaited(telemetry.record(TelemetryEvent.projectCreated));
    if (context.mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ProjectBoardScreen(project: project, store: store),
        ),
      );
    }
  }
}

class _ItemDetailsSheet extends StatefulWidget {
  const _ItemDetailsSheet({required this.item, required this.onUpdated});

  final ClutterItem item;
  final ValueChanged<ClutterItem> onUpdated;

  @override
  State<_ItemDetailsSheet> createState() => _ItemDetailsSheetState();
}

class _ItemDetailsSheetState extends State<_ItemDetailsSheet> {
  late ClutterItem item;
  bool identifying = false;
  String? identityStatus;
  String? correctionStatus;

  ListingGuide get guide => ListingGuide.forItem(item);

  @override
  void initState() {
    super.initState();
    item = widget.item;
  }

  Future<void> _open(Uri uri) async {
    var opened = false;
    try {
      opened = await openMarketplaceLink(uri);
    } on Object {
      opened = false;
    }
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Could not open that marketplace link. Please try again.',
          ),
        ),
      );
    }
  }

  Future<void> _identifyFromLabel() async {
    final proceed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Photograph the model label'),
        content: const SingleChildScrollView(
          child: Text(
            'Look for the maker, model, model number, or part number. Those details help find the exact product.\n\nA unique serial number usually does not help with pricing. If it appears on the same label, ClutterCash asks the AI not to return or save it—only to report that one was detected.\n\nThe photo is sent to Google Gemini under the free beta and may be reviewed or used to improve products. Avoid faces, addresses, documents, account details, or anything else private.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(dialogContext, true),
            icon: const Icon(Icons.camera_alt_rounded),
            label: const Text('Open camera'),
          ),
        ],
      ),
    );
    if (proceed != true || !mounted) return;

    final photo = await ImagePicker().pickImage(
      source: ImageSource.camera,
      maxWidth: 2000,
      imageQuality: 90,
    );
    if (photo == null || !mounted) return;

    setState(() {
      identifying = true;
      identityStatus = null;
    });
    try {
      final result = await (await _activeScanApi()).identifyFromLabel(
        await photo.readAsBytes(),
        item,
      );
      if (!mounted) return;
      setState(() {
        item = result.item;
        identifying = false;
        final identity = [
          result.manufacturer,
          result.model,
        ].where((part) => part.trim().isNotEmpty).join(' ');
        identityStatus = identity.isEmpty
            ? 'No exact model was readable. Try a sharper, closer label photo.'
            : 'Identity improved: $identity.${result.serialDetected ? ' A serial was detected but not returned or saved.' : ''}';
      });
      widget.onUpdated(item);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        identifying = false;
        identityStatus = error is ScanApiException
            ? error.message
            : 'The label could not be analyzed. Try a sharper close photo.';
      });
    }
  }

  Future<void> _openCorrection() async {
    final updated = await showModalBottomSheet<ClutterItem>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _paper,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (_) => _ItemCorrectionSheet(item: item),
    );
    if (updated == null || !mounted) return;
    setState(() {
      item = updated;
      correctionStatus =
          'Item and potential range updated. Verify with marketplace results before posting.';
    });
    widget.onUpdated(updated);
    unawaited(TelemetryScope.of(context).record(TelemetryEvent.itemCorrected));
  }

  @override
  Widget build(BuildContext context) => DraggableScrollableSheet(
    expand: false,
    initialChildSize: .9,
    minChildSize: .58,
    maxChildSize: .96,
    builder: (_, controller) => SingleChildScrollView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(22, 12, 22, 34),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
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
          const SizedBox(height: 20),
          Row(
            children: [
              if (item.typicalValue >= 100)
                const _Pill(text: 'BIG TICKET', color: _orange),
              const Spacer(),
              _ConfidenceChip(item.confidence),
            ],
          ),
          const SizedBox(height: 12),
          Text(item.name, style: Theme.of(context).textTheme.headlineLarge),
          const SizedBox(height: 7),
          Text(
            '\$${item.lowValue.toInt()}–\$${item.highValue.toInt()} AI estimate',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: _forest,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'Estimate—not an appraisal or live marketplace result.',
            style: TextStyle(color: _muted, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 18),
          _InfoBlock(
            icon: Icons.storefront_outlined,
            title: 'Best place to try: ${guide.recommendedMarketplace.label}',
            body: guide.marketplaceReason,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: identifying ? null : _identifyFromLabel,
            icon: const Icon(Icons.document_scanner_outlined),
            label: Text(
              identifying
                  ? 'Reading the model label…'
                  : 'Improve with a model-label photo',
            ),
          ),
          if (identifying) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          if (identityStatus != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEAF3EB),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                identityStatus!,
                style: const TextStyle(
                  color: _forest,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
          if (correctionStatus != null) ...[
            const SizedBox(height: 8),
            Text(
              correctionStatus!,
              style: const TextStyle(
                color: _forest,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: 22),
          Text(
            'Price research',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 5),
          Text(guide.evidenceDisclaimer),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () => _open(guide.ebaySold),
            icon: const Icon(Icons.receipt_long_outlined),
            label: const Text('Sold results'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => _open(guide.ebayActive),
            icon: const Icon(Icons.sell_outlined),
            label: const Text('Active listings'),
          ),
          if (guide.recommendedMarketplace != Marketplace.ebay &&
              guide.recommendedMarketplace != Marketplace.consignment &&
              guide.recommendedMarketplace != Marketplace.donate) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => _open(guide.recommendedSearch),
              icon: const Icon(Icons.open_in_new_rounded),
              label: Text('Search ${guide.recommendedMarketplace.label}'),
            ),
          ],
          const SizedBox(height: 9),
          Text(
            'Search: ${guide.searchQuery}',
            style: const TextStyle(color: _muted, fontSize: 12),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: _openCorrection,
            child: const Text('I need to correct this item'),
          ),
        ],
      ),
    ),
  );
}

class _ItemCorrectionSheet extends StatefulWidget {
  const _ItemCorrectionSheet({required this.item});

  final ClutterItem item;

  @override
  State<_ItemCorrectionSheet> createState() => _ItemCorrectionSheetState();
}

class _ItemCorrectionSheetState extends State<_ItemCorrectionSheet> {
  late final TextEditingController nameController;
  late final TextEditingController lowController;
  late final TextEditingController typicalController;
  late final TextEditingController highController;
  String? error;

  @override
  void initState() {
    super.initState();
    nameController = TextEditingController(text: widget.item.name);
    lowController = TextEditingController(
      text: widget.item.lowValue.toStringAsFixed(0),
    );
    typicalController = TextEditingController(
      text: widget.item.typicalValue.toStringAsFixed(0),
    );
    highController = TextEditingController(
      text: widget.item.highValue.toStringAsFixed(0),
    );
  }

  @override
  void dispose() {
    nameController.dispose();
    lowController.dispose();
    typicalController.dispose();
    highController.dispose();
    super.dispose();
  }

  void _save() {
    final name = nameController.text.trim();
    final low = double.tryParse(lowController.text.trim());
    final typical = double.tryParse(typicalController.text.trim());
    final high = double.tryParse(highController.text.trim());
    if (name.isEmpty) {
      setState(() => error = 'Enter the item name you verified.');
      return;
    }
    if (low == null ||
        typical == null ||
        high == null ||
        low < 0 ||
        typical < low ||
        high < typical) {
      setState(
        () => error = 'Enter non-negative values from low to typical to high.',
      );
      return;
    }
    Navigator.pop(
      context,
      widget.item.copyWith(
        name: name,
        lowValue: low,
        typicalValue: typical,
        highValue: high,
      ),
    );
  }

  Widget _valueField(TextEditingController controller, String label) =>
      TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(
          labelText: label,
          prefixText: r'$ ',
          border: const OutlineInputBorder(),
        ),
      );

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(22, 16, 22, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
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
            const SizedBox(height: 20),
            Text(
              'Correct this item',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            const Text(
              'Use details you verified. These are potential selling-value estimates, not completed sale prices.',
            ),
            const SizedBox(height: 18),
            TextField(
              controller: nameController,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Item name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Potential selling range',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            _valueField(lowController, 'Low potential value'),
            const SizedBox(height: 10),
            _valueField(typicalController, 'Typical potential value'),
            const SizedBox(height: 10),
            _valueField(highController, 'High potential value'),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: const TextStyle(color: Colors.redAccent)),
            ],
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.check_rounded),
              label: const Text('Save correction'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
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
                'Potential resale value',
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
          'Your room may contain private details. Avoid faces, addresses, mail, medication, keys, documents, and other sensitive belongings. Live photos are sent through ClutterCash to Google Gemini only after you accept the upload notice.',
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
    final telemetry = TelemetryScope.of(context);
    setState(() {
      project = project.updateStatus(item.id, status);
    });
    await widget.store?.save(project);
    unawaited(telemetry.record(TelemetryEvent.itemStatusUpdated));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      backgroundColor: _cream,
      title: Text(
        project.name,
        style: const TextStyle(fontWeight: FontWeight.w900),
      ),
      actions: const [],
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
                    const _EyebrowLight('CLEARING PROGRESS'),
                    const SizedBox(height: 7),
                    Text(
                      '${project.clearedCount} ${project.clearedCount == 1 ? 'item' : 'items'} cleared',
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
                'Mark an item after it leaves your space. Potential values are estimates, not completed sales.',
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
