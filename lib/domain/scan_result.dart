import 'item.dart';
import 'value_validation.dart';

class ScanResult {
  const ScanResult({
    required this.id,
    required this.projectId,
    required this.createdAt,
    required this.items,
  });

  final String id;
  final String projectId;
  final DateTime createdAt;
  final List<ClutterItem> items;

  double get lowTotal => safeValueTotal(items.map((item) => item.lowValue));
  double get typicalTotal =>
      safeValueTotal(items.map((item) => item.typicalValue));
  double get highTotal => safeValueTotal(items.map((item) => item.highValue));

  List<ClutterItem> bigTicketItems({double threshold = 100}) =>
      items.where((item) => item.typicalValue >= threshold).toList();
}
