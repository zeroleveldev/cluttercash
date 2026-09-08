import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../domain/item.dart';
import '../domain/scan_result.dart';

class ScanApi {
  const ScanApi({required this.baseUrl, this._client});

  final String baseUrl;
  final http.Client? _client;

  bool get isConfigured => baseUrl.trim().isNotEmpty;

  Future<ScanResult> analyze(
    Uint8List bytes, {
    String projectId = 'quick-scan',
  }) async {
    if (!isConfigured) {
      throw const ScanApiException('Live analysis is not configured.');
    }
    final client = _client ?? http.Client();
    try {
      final request =
          http.MultipartRequest(
              'POST',
              Uri.parse('${baseUrl.replaceAll(RegExp(r'/$'), '')}/v1/scans'),
            )
            ..fields['betaConsent'] = 'true'
            ..files.add(
              http.MultipartFile.fromBytes(
                'image',
                bytes,
                filename: 'room.jpg',
                contentType: MediaType('image', 'jpeg'),
              ),
            );
      final streamed = await client
          .send(request)
          .timeout(const Duration(seconds: 55));
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode != 200) {
        final message =
            _errorMessage(body) ?? 'Scan failed (${streamed.statusCode}).';
        throw ScanApiException(message);
      }
      return parseResponse(body, projectId: projectId);
    } finally {
      if (_client == null) client.close();
    }
  }

  static ScanResult parseResponse(String body, {required String projectId}) {
    final dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } catch (_) {
      throw const FormatException('Scan response was not valid JSON.');
    }
    if (decoded is! Map<String, dynamic> ||
        decoded['sceneSummary'] is! String ||
        decoded['items'] is! List ||
        (decoded['items'] as List).isEmpty) {
      throw const FormatException(
        'Scan response did not match the expected contract.',
      );
    }
    final items = <ClutterItem>[];
    for (final raw in decoded['items'] as List) {
      if (raw is! Map<String, dynamic> || raw['name'] is! String) {
        throw const FormatException('Invalid scan item.');
      }
      final box = raw['box'] is Map<String, dynamic>
          ? raw['box'] as Map<String, dynamic>
          : const <String, dynamic>{};
      items.add(
        ClutterItem(
          id: '${raw['id'] ?? 'item-${items.length + 1}'}',
          name: raw['name'] as String,
          category: '${raw['category'] ?? 'Other'}',
          lowValue: _number(raw['lowValue']),
          typicalValue: _number(raw['typicalValue']),
          highValue: _number(raw['highValue']),
          confidence: _confidence(raw['confidence']),
          effort: _effort(raw['effort']),
          route: _route(raw['route']),
          reason: '${raw['reason'] ?? ''}',
          listingTitle: '${raw['listingTitle'] ?? ''}',
          listingDescription: '${raw['listingDescription'] ?? ''}',
          searchQuery: '${raw['searchQuery'] ?? ''}',
          marketplace: _marketplace(raw['marketplace']),
          marketplaceReason: '${raw['marketplaceReason'] ?? ''}',
          missingDetails: raw['missingDetails'] is List
              ? (raw['missingDetails'] as List)
                    .map((detail) => detail.toString())
                    .where((detail) => detail.trim().isNotEmpty)
                    .take(6)
                    .toList()
              : const [],
          boxLeft: _number(box['left']),
          boxTop: _number(box['top']),
          boxWidth: _number(box['width']),
          boxHeight: _number(box['height']),
        ),
      );
    }
    return ScanResult(
      id: 'scan-${DateTime.now().millisecondsSinceEpoch}',
      projectId: projectId,
      createdAt: DateTime.now(),
      items: items,
    );
  }

  static double _number(dynamic value) => value is num ? value.toDouble() : 0;
  static Confidence _confidence(dynamic value) =>
      Confidence.values.where((e) => e.name == value).firstOrNull ??
      Confidence.low;
  static SaleEffort _effort(dynamic value) =>
      SaleEffort.values.where((e) => e.name == value).firstOrNull ??
      SaleEffort.medium;
  static ItemRoute _route(dynamic value) =>
      ItemRoute.values.where((e) => e.name == value).firstOrNull ??
      ItemRoute.keep;
  static Marketplace _marketplace(dynamic value) =>
      Marketplace.values.where((e) => e.name == value).firstOrNull ??
      Marketplace.localPickup;
  static String? _errorMessage(String body) {
    try {
      final value = jsonDecode(body);
      return value is Map ? value['error']?.toString() : null;
    } catch (_) {
      return null;
    }
  }
}

class ScanApiException implements Exception {
  const ScanApiException(this.message);
  final String message;
  @override
  String toString() => message;
}
