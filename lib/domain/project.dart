import 'item.dart';

class CleanoutProject {
  const CleanoutProject({
    required this.id,
    required this.name,
    required this.items,
    required this.createdAt,
  });

  factory CleanoutProject.empty({required String id, required String name}) =>
      CleanoutProject(
        id: id,
        name: name,
        items: const [],
        createdAt: DateTime.now(),
      );

  final String id;
  final String name;
  final List<ClutterItem> items;
  final DateTime createdAt;

  CleanoutProject addItem(ClutterItem item) => _with([...items, item]);

  CleanoutProject updateStatus(String itemId, ItemStatus status) => _with(
    items
        .map((item) => item.id == itemId ? item.copyWith(status: status) : item)
        .toList(),
  );

  CleanoutProject recordSale(
    String itemId, {
    required double soldPrice,
    double fees = 0,
  }) => _with(
    items
        .map(
          (item) => item.id == itemId
              ? item.copyWith(
                  status: ItemStatus.sold,
                  soldPrice: soldPrice,
                  fees: fees,
                )
              : item,
        )
        .toList(),
  );

  CleanoutProject correctItem(
    String itemId, {
    String? name,
    double? typicalValue,
  }) => _with(
    items
        .map(
          (item) => item.id == itemId
              ? item.copyWith(name: name, typicalValue: typicalValue)
              : item,
        )
        .toList(),
  );

  ClutterItem itemById(String itemId) =>
      items.firstWhere((item) => item.id == itemId);

  double get realizedEarnings => items
      .where((item) => item.status == ItemStatus.sold)
      .fold(0, (sum, item) => sum + (item.soldPrice ?? 0) - item.fees);

  int get clearedCount => items
      .where(
        (item) => const {
          ItemStatus.sold,
          ItemStatus.donated,
          ItemStatus.recycled,
        }.contains(item.status),
      )
      .length;

  double get progress => items.isEmpty ? 0 : clearedCount / items.length;

  CleanoutProject _with(List<ClutterItem> next) => CleanoutProject(
    id: id,
    name: name,
    items: List.unmodifiable(next),
    createdAt: createdAt,
  );
}
