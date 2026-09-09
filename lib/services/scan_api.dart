import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../domain/item.dart';

import '../domain/scan_result.dart';

class ScanApi {
  const ScanApi({required this.baseUrl, this.inviteCode = '', this._client});

  final String baseUrl;
  final String inviteCode;
  final http.Client? _client;

  bool get isConfigured =>
      baseUrl.trim().isNotEmpty && inviteCode.trim().isNotEmpty;

  Future<ScanResult> analyze(
    Uint8List bytes, {
    String projectId = 'quick-scan',
  }) async {
    if (!isConfigured) {
      throw const ScanApiException('Live analysis is not configured.');
    }
    final image = _imageFormat(bytes);
    final client = _client ?? http.Client();
    try {
      final request =
          http.MultipartRequest(
              'POST',
              Uri.parse('${baseUrl.replaceAll(RegExp(r'/$'), '')}/v1/scans'),
            )
            ..headers['X-ClutterCash-Invite'] = inviteCode.trim()
            ..fields['betaConsent'] = 'true'
            ..files.add(
              http.MultipartFile.fromBytes(
                'image',
                bytes,
                filename: 'room.${image.extension}',
                contentType: image.contentType,
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

  Future<ItemIdentification> identifyFromLabel(
    Uint8List bytes,
    ClutterItem item,
  ) async {
    if (!isConfigured) {
      throw const ScanApiException('Live analysis is not configured.');
    }
    final image = _imageFormat(bytes);
    final client = _client ?? http.Client();
    try {
      final request =
          http.MultipartRequest(
              'POST',
              Uri.parse(
                '${baseUrl.replaceAll(RegExp(r'/$'), '')}/v1/items/identify',
              ),
            )
            ..headers['X-ClutterCash-Invite'] = inviteCode.trim()
            ..fields['betaConsent'] = 'true'
            ..fields['itemName'] = item.name
            ..fields['category'] = item.category
            ..files.add(
              http.MultipartFile.fromBytes(
                'image',
                bytes,
                filename: 'model-label.${image.extension}',
                contentType: image.contentType,
              ),
            );
      final streamed = await client
          .send(request)
          .timeout(const Duration(seconds: 55));
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode != 200) {
        final message =
            _errorMessage(body) ??
            'Label analysis failed (${streamed.statusCode}).';
        throw ScanApiException(message);
      }
      return parseIdentificationResponse(body, item);
    } finally {
      if (_client == null) client.close();
    }
  }

  static ItemIdentification parseIdentificationResponse(
    String body,
    ClutterItem item,
  ) {
    final dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } catch (_) {
      throw const FormatException('Label response was not valid JSON.');
    }
    if (decoded is! Map<String, dynamic> || decoded['exactName'] is! String) {
      throw const FormatException(
        'Label response did not match the expected contract.',
      );
    }
    final exactName = (decoded['exactName'] as String).trim();
    final updated = item.copyWith(
      name: exactName.isEmpty ? item.name : exactName,
      confidence: _confidence(decoded['confidence']),
      searchQuery: '${decoded['searchQuery'] ?? item.searchQuery}',
      marketplace: _marketplace(decoded['marketplace']),
      marketplaceReason:
          '${decoded['marketplaceReason'] ?? item.marketplaceReason}',
    );
    return ItemIdentification(
      item: updated,
      manufacturer: '${decoded['manufacturer'] ?? ''}',
      model: '${decoded['model'] ?? ''}',
      serialDetected: decoded['serialDetected'] == true,
    );
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
          searchQuery: '${raw['searchQuery'] ?? ''}',
          marketplace: _marketplace(raw['marketplace']),
          marketplaceReason: '${raw['marketplaceReason'] ?? ''}',

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

  static _ImageFormat _imageFormat(Uint8List bytes) {
    if (bytes.length >= 3 &&
        bytes[0] == 0xff &&
        bytes[1] == 0xd8 &&
        bytes[2] == 0xff) {
      return const _ImageFormat('jpg', 'jpeg');
    }
    if (bytes.length >= 8 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4e &&
        bytes[3] == 0x47 &&
        bytes[4] == 0x0d &&
        bytes[5] == 0x0a &&
        bytes[6] == 0x1a &&
        bytes[7] == 0x0a) {
      return const _ImageFormat('png', 'png');
    }
    if (bytes.length >= 12 &&
        bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50) {
      return const _ImageFormat('webp', 'webp');
    }
    throw const ScanApiException(
      'Choose a JPEG, PNG, or WebP image and try again.',
    );
  }
}

class _ImageFormat {
  const _ImageFormat(this.extension, this.subtype);

  final String extension;
  final String subtype;
  MediaType get contentType => MediaType('image', subtype);
}

class ScanApiException implements Exception {
  const ScanApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class ItemIdentification {
  const ItemIdentification({
    required this.item,
    required this.manufacturer,
    required this.model,
    required this.serialDetected,
  });

  final ClutterItem item;
  final String manufacturer;
  final String model;
  final bool serialDetected;
}
