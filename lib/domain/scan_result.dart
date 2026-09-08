import 'item.dart';

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

  double get lowTotal => items.fold(0, (sum, item) => sum + item.lowValue);
  double get typicalTotal =>
      items.fold(0, (sum, item) => sum + item.typicalValue);
  double get highTotal => items.fold(0, (sum, item) => sum + item.highValue);

  List<ClutterItem> bigTicketItems({double threshold = 100}) =>
      items.where((item) => item.typicalValue >= threshold).toList();
}
