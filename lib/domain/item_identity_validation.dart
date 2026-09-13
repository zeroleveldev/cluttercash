import 'item.dart';

String validatedItemId(dynamic value) {
  if (value is! String || value.trim().isEmpty || value.length > 128) {
    throw const FormatException('Invalid item ID.');
  }
  return value;
}

void validateItemIds(Iterable<ClutterItem> items) {
  final ids = <String>{};
  for (final item in items) {
    if (!ids.add(validatedItemId(item.id))) {
      throw const FormatException('Duplicate item ID.');
    }
  }
}
