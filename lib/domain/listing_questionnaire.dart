import 'item.dart';

class ListingQuestionnaire {
  static const workingCondition = 'workingCondition';
  static const cosmeticWear = 'cosmeticWear';
  static const measurements = 'measurements';
  static const includedItems = 'includedItems';
  static const otherNotes = 'otherNotes';
  static const _marker = '\n\nSeller-confirmed details:\n';

  static String detailKey(String detail) => 'detail::$detail';

  static bool usesCoreQuestion(String detail) {
    final normalized = detail.toLowerCase();
    return normalized.contains('work') ||
        normalized.contains('operation') ||
        normalized.contains('function') ||
        normalized.contains('damage') ||
        normalized.contains('wear') ||
        normalized.contains('measure') ||
        normalized.contains('dimension') ||
        normalized.contains('size') ||
        normalized.contains('include') ||
        normalized.contains('accessor');
  }

  static ClutterItem apply(ClutterItem item, Map<String, String> answers) {
    final confirmed = <String, String>{};
    for (final entry in answers.entries) {
      final value = entry.value.trim();
      if (value.isEmpty) continue;
      confirmed[entry.key] = value.length <= 300
          ? value
          : value.substring(0, 300);
    }

    final originalDescription = item.listingDescription
        .split(_marker)
        .first
        .trim();
    final lines = confirmed.entries
        .map((entry) => '${_label(entry.key)}: ${entry.value}')
        .toList();
    final description = lines.isEmpty
        ? originalDescription
        : '$originalDescription$_marker${lines.join('\n')}';
    final remaining = item.missingDetails
        .where((detail) => !_answersDetail(detail, confirmed))
        .toList();

    return item.copyWith(
      listingDescription: description,
      confirmedDetails: Map.unmodifiable(confirmed),
      missingDetails: List.unmodifiable(remaining),
    );
  }

  static bool _answersDetail(String detail, Map<String, String> confirmed) {
    if (confirmed.containsKey(detailKey(detail))) return true;
    final normalized = detail.toLowerCase();
    if ((normalized.contains('work') ||
            normalized.contains('operation') ||
            normalized.contains('function')) &&
        confirmed.containsKey(workingCondition)) {
      return true;
    }
    if ((normalized.contains('damage') || normalized.contains('wear')) &&
        confirmed.containsKey(cosmeticWear)) {
      return true;
    }
    if ((normalized.contains('measure') ||
            normalized.contains('dimension') ||
            normalized.contains('size')) &&
        confirmed.containsKey(measurements)) {
      return true;
    }
    if ((normalized.contains('include') ||
            normalized.contains('accessor') ||
            normalized.contains('lens')) &&
        confirmed.containsKey(includedItems)) {
      return true;
    }
    return false;
  }

  static String _label(String key) {
    if (key.startsWith('detail::')) return key.substring('detail::'.length);
    return switch (key) {
      workingCondition => 'Working condition',
      cosmeticWear => 'Cosmetic wear or damage',
      measurements => 'Measurements',
      includedItems => 'Included items and accessories',
      otherNotes => 'Other seller notes',
      _ => 'Seller note',
    };
  }
}
