import 'dart:convert';

import 'package:http/http.dart' as http;

class BetaAccessApi {
  const BetaAccessApi({required this.baseUrl, this.client});

  final String baseUrl;
  final http.Client? client;

  Future<String> requestAccess({
    required String email,
    String name = '',
    String device = '',
  }) async {
    if (baseUrl.trim().isEmpty) {
      throw const BetaAccessApiException(
        'Beta access requests are not configured.',
      );
    }
    final activeClient = client ?? http.Client();
    try {
      final response = await activeClient
          .post(
            Uri.parse(
              '${baseUrl.replaceAll(RegExp(r'/$'), '')}/v1/access-requests',
            ),
            headers: const {'Content-Type': 'application/json'},
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
      if (requestId.isEmpty) {
        throw const BetaAccessApiException(
          'The access request could not be confirmed. Try again.',
        );
      }
      return requestId;
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

class BetaAccessApiException implements Exception {
  const BetaAccessApiException(this.message);

  final String message;

  @override
  String toString() => message;
}
