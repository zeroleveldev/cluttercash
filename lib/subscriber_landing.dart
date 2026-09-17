import 'package:flutter/material.dart';
import 'package:url_launcher/link.dart';
import 'services/subscriber.dart';

class SubscriberLanding extends StatefulWidget {
  const SubscriberLanding({
    super.key,
    required this.state,
    this.token,
    this.billingReturn = false,
    this.onClose,
  });
  final SubscriberState state;
  final String? token;
  final bool billingReturn;
  final VoidCallback? onClose;
  @override
  State<SubscriberLanding> createState() => _SubscriberLandingState();
}

class _SubscriberLandingState extends State<SubscriberLanding> {
  final _email = TextEditingController();
  Uri? _hosted;
  bool _portal = false;
  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _prepare(bool portal) async {
    setState(() => _hosted = null);
    final uri = await widget.state.hosted(portal: portal);
    if (mounted) {
      setState(() {
        _hosted = uri;
        _portal = portal;
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Optional subscription')),
    body: ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        final state = widget.state;
        final authenticated = state.sessionToken != null;
        final status = state.status;
        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const Text(
                  'TEST MODE — no live billing',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const Text(
                  'Optional USD 1.99/month for 10 scans per billing month. Your three free scans need no signup or card. Saved projects, corrections and research remain free.',
                ),
                Text(state.message),
                if (widget.billingReturn)
                  const Text(
                    'Returning from billing does not confirm payment or cancellation. Refresh server status.',
                  )
                else if (widget.token != null)
                  const Text(
                    'Confirm only if you requested this email in this browser. No scan, upload or checkout starts here.',
                  ),
                if (!state.api.enabled)
                  const Text(
                    'Test billing is not enabled. Continue to the free app.',
                  )
                else ...[
                  if (widget.token != null && !authenticated)
                    FilledButton(
                      onPressed: state.busy
                          ? null
                          : () => state.confirm(widget.token!),
                      child: const Text('Confirm verification'),
                    ),
                  if (state.reauthRequired)
                    const Text(
                      'Paid access needs verification. Restore below or Sign out explicitly to use free access. Scans stay blocked until then.',
                    ),
                  if (!authenticated || state.paidIntent) ...[
                    const Text(
                      'Subscribe or restore: verify the same email used for your subscription. Open the link in this browser within ten minutes; on a new device, request a new link here. Email verification alone grants no scans.',
                    ),
                    TextField(
                      controller: _email,
                      enabled: !state.busy,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: const InputDecoration(
                        labelText: 'Subscriber email',
                      ),
                    ),
                    OutlinedButton(
                      onPressed: state.busy
                          ? null
                          : () => state.challenge(_email.text),
                      child: const Text('Send verification link / restore'),
                    ),
                  ],
                  if (authenticated || widget.billingReturn)
                    OutlinedButton(
                      onPressed: state.busy ? null : state.refresh,
                      child: const Text('Refresh server billing status'),
                    ),
                  if (status != null) ...[
                    Text(
                      status.entitled
                          ? '${status.remaining} paid scans available (server status).'
                          : 'No paid scans available. Status: ${status.state}. A subscription binding is not payment confirmation.',
                    ),
                    Text(
                      status.periodEnd == null
                          ? 'Paid period not confirmed.'
                          : 'Paid period ends: ${DateTime.fromMillisecondsSinceEpoch(status.periodEnd!, isUtc: true).toIso8601String()} (UTC).',
                    ),
                    const Text(
                      'Renewal is not confirmed. Refresh after billing changes; returns never grant scans.',
                    ),
                  ],
                  if (authenticated) ...[
                    if (status?.bound != true)
                      OutlinedButton(
                        onPressed: state.busy ? null : () => _prepare(false),
                        child: const Text('Prepare test Checkout'),
                      ),
                    OutlinedButton(
                      onPressed: state.busy ? null : () => _prepare(true),
                      child: const Text('Prepare subscription management'),
                    ),
                    if (_hosted != null)
                      Link(
                        uri: _hosted,
                        target: LinkTarget.self,
                        builder: (context, followLink) => FilledButton(
                          onPressed: state.busy ? null : followLink,
                          child: Text(
                            _portal
                                ? 'Open Stripe management'
                                : 'Open Stripe test Checkout',
                          ),
                        ),
                      ),
                    const Text(
                      'Stripe opens only when you choose the link. Sign out explicitly to use free access instead; an expired paid session does not silently use free scans.',
                    ),
                  ],
                  if (authenticated || state.paidIntent)
                    TextButton(
                      onPressed: state.busy
                          ? null
                          : () async {
                              setState(() => _hosted = null);
                              await state.logout();
                            },
                      child: const Text('Sign out'),
                    ),
                ],

                if (widget.onClose != null)
                  TextButton(
                    onPressed: widget.onClose,
                    child: Text(
                      state.paidIntent
                          ? 'Back to app (paid access retained)'
                          : 'Continue to free app',
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    ),
  );
}
