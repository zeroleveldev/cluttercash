import 'dart:convert';

import 'package:http/http.dart' as http;

class BetaAccessApi {
  const BetaAccessApi({required this.baseUrl, this.client});

  final String baseUrl;
  final http.Client? client;

  Future<BetaAccessReceipt> requestAccess({
    required String email,
    required String deviceToken,
    String name = '',
    String device = '',
  }) async {
    if (baseUrl.trim().isEmpty) {
      throw const BetaAccessApiException(
        'Beta access requests are not configured.',
      );
    }
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(deviceToken.trim())) {
      throw const BetaAccessApiException(
        'This browser could not be linked to the request. Refresh and try again.',
      );
    }
    final activeClient = client ?? http.Client();
    try {
      final response = await activeClient
          .post(
            Uri.parse(
              '${baseUrl.replaceAll(RegExp(r'/$'), '')}/v1/access-requests',
            ),
            headers: {
              'Content-Type': 'application/json',
              'X-ClutterCash-Device': deviceToken.trim(),
            },
            body: jsonEncode({
              'email': email.trim().toLowerCase(),
              'name': name.trim(),
              'device': device.trim(),
            }),
          )
          .timeout(const Duration(seconds: 12));
      final body = _decode(response.body);
      if (response.statusCode != 202 || body['accepted'] != true) {
        throw BetaAccessApiException(
          body['error']?.toString() ??
              'The access request could not be delivered. Try again.',
        );
      }
      final requestId = body['requestId']?.toString() ?? '';
      final requestToken = body['requestToken']?.toString() ?? '';
      if (!RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch(requestId) ||
          !RegExp(r'^[a-f0-9]{64}$').hasMatch(requestToken)) {
        throw const BetaAccessApiException(
          'The access request could not be confirmed. Try again.',
        );
      }
      return BetaAccessReceipt(
        requestId: requestId,
        requestToken: requestToken,
      );
    } on BetaAccessApiException {
      rethrow;
    } on Object {
      throw const BetaAccessApiException(
        'Could not reach ClutterCash. Check your connection and try again.',
      );
    } finally {
      if (client == null) activeClient.close();
    }
  }

  Future<BetaAccessStatus> checkStatus(BetaAccessReceipt receipt) async {
    if (baseUrl.trim().isEmpty) {
      throw const BetaAccessApiException(
        'Beta access requests are not configured.',
      );
    }
    if (!RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch(receipt.requestId) ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(receipt.requestToken)) {
      throw const BetaAccessApiException(
        'The saved access request is invalid.',
      );
    }
    final activeClient = client ?? http.Client();
    try {
      final response = await activeClient
          .get(
            Uri.parse(
              '${baseUrl.replaceAll(RegExp(r'/$'), '')}/v1/access-requests/'
              '${Uri.encodeComponent(receipt.requestId)}/status',
            ),
            headers: {'X-ClutterCash-Request': receipt.requestToken},
          )
          .timeout(const Duration(seconds: 12));
      final body = _decode(response.body);
      if (response.statusCode != 200) {
        throw BetaAccessApiException(
          body['error']?.toString() ??
              'The approval status could not be checked. Try again.',
        );
      }
      return switch (body['status']) {
        'pending' => BetaAccessStatus.pending,
        'approved' => BetaAccessStatus.approved,
        _ => throw const BetaAccessApiException(
          'The approval status could not be confirmed. Try again.',
        ),
      };
    } on BetaAccessApiException {
      rethrow;
    } on Object {
      throw const BetaAccessApiException(
        'Could not reach ClutterCash. Check your connection and try again.',
      );
    } finally {
      if (client == null) activeClient.close();
    }
  }

  static Map<String, dynamic> _decode(String value) {
    try {
      final decoded = jsonDecode(value);
      return decoded is Map<String, dynamic>
          ? decoded
          : const <String, dynamic>{};
    } on FormatException {
      return const <String, dynamic>{};
    }
  }
}

class BetaAccessReceipt {
  const BetaAccessReceipt({
    required this.requestId,
    required this.requestToken,
  });

  final String requestId;
  final String requestToken;
}

enum BetaAccessStatus { pending, approved }

class BetaAccessApiException implements Exception {
  const BetaAccessApiException(this.message);

  final String message;

  @override
  String toString() => message;
}
