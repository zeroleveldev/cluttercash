import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/item.dart';
import '../domain/project.dart';

class ProjectStore {
  const ProjectStore(this._preferences);
  final SharedPreferences _preferences;
  static const _prefix = 'cluttercash.project.';

  Future<void> save(CleanoutProject project) async {
    final encoded = jsonEncode({
      'id': project.id,
      'name': project.name,
      'createdAt': project.createdAt.toIso8601String(),
      'items': project.items.map(_itemToJson).toList(),
    });
    await _preferences.setString('$_prefix${project.id}', encoded);
  }

  Future<CleanoutProject?> load(String id) async {
    final encoded = _preferences.getString('$_prefix$id');
    if (encoded == null) return null;
    try {
      final value = jsonDecode(encoded);
      if (value is! Map<String, dynamic> || value['items'] is! List) {
        return null;
      }
      return CleanoutProject(
        id: '${value['id']}',
        name: '${value['name']}',
        createdAt: DateTime.tryParse('${value['createdAt']}') ?? DateTime.now(),
        items: (value['items'] as List)
            .whereType<Map<String, dynamic>>()
            .map(_itemFromJson)
            .toList(),
      );
    } on Object {
      return null;
    }
  }

  Future<List<CleanoutProject>> loadAll() async {
    final projects = <CleanoutProject>[];
    for (final key in _preferences.getKeys().where(
      (key) => key.startsWith(_prefix),
    )) {
      final project = await load(key.substring(_prefix.length));
      if (project != null) projects.add(project);
    }
    projects.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return projects;
  }

  Future<void> delete(String id) => _preferences.remove('$_prefix$id');

  static Map<String, dynamic> _itemToJson(ClutterItem item) => {
    'id': item.id,
    'name': item.name,
    'lowValue': item.lowValue,
    'typicalValue': item.typicalValue,
    'highValue': item.highValue,
    'confidence': item.confidence.name,
    'effort': item.effort.name,
    'route': item.route.name,
    'status': item.status.name,
    'soldPrice': item.soldPrice,
    'fees': item.fees,
    'category': item.category,
    'reason': item.reason,
    'boxLeft': item.boxLeft,
    'boxTop': item.boxTop,
    'boxWidth': item.boxWidth,
    'boxHeight': item.boxHeight,
  };

  static ClutterItem _itemFromJson(Map<String, dynamic> value) => ClutterItem(
    id: '${value['id']}',
    name: '${value['name']}',
    lowValue: _number(value['lowValue']),
    typicalValue: _number(value['typicalValue']),
    highValue: _number(value['highValue']),
    confidence: _enum(Confidence.values, value['confidence'], Confidence.low),
    effort: _enum(SaleEffort.values, value['effort'], SaleEffort.medium),
    route: _enum(ItemRoute.values, value['route'], ItemRoute.keep),
    status: _enum(ItemStatus.values, value['status'], ItemStatus.unreviewed),
    soldPrice: value['soldPrice'] == null ? null : _number(value['soldPrice']),
    fees: _number(value['fees']),
    category: '${value['category'] ?? 'Other'}',
    reason: '${value['reason'] ?? ''}',
    boxLeft: _number(value['boxLeft']),
    boxTop: _number(value['boxTop']),
    boxWidth: _number(value['boxWidth']),
    boxHeight: _number(value['boxHeight']),
  );

  static double _number(dynamic value) => value is num ? value.toDouble() : 0;
  static T _enum<T extends Enum>(List<T> values, dynamic name, T fallback) =>
      values.where((value) => value.name == name).firstOrNull ?? fallback;
}
