import 'item.dart';

class CleanoutProject {
  const CleanoutProject({
    required this.id,
    required this.name,
    required this.items,
    required this.createdAt,
    this.isDemo = false,
  });

  factory CleanoutProject.empty({
    required String id,
    required String name,
    bool isDemo = false,
  }) => CleanoutProject(
    id: id,
    name: name,
    items: const [],
    isDemo: isDemo,
    createdAt: DateTime.now(),
  );

  final String id;
  final String name;
  final List<ClutterItem> items;
  final DateTime createdAt;
  final bool isDemo;

  CleanoutProject addItem(ClutterItem item) => _with([...items, item]);

  CleanoutProject replaceItem(ClutterItem updated) => _with(
    items.map((item) => item.id == updated.id ? updated : item).toList(),
  );

  CleanoutProject updateStatus(String itemId, ItemStatus status) => _with(
    items
        .map((item) => item.id == itemId ? item.copyWith(status: status) : item)
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
    isDemo: isDemo,
  );
}
