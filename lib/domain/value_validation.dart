// Supported estimate range, shared by API, correction and local storage.
const double maxItemValue = 1000000;

bool validValueRange(double low, double typical, double high) =>
    low.isFinite &&
    typical.isFinite &&
    high.isFinite &&
    low >= 0 &&
    low <= typical &&
    typical <= high &&
    high <= maxItemValue;

double estimateNumber(dynamic value) {
  if (value is! num || !value.isFinite || value < 0 || value > maxItemValue) {
    throw const FormatException('Unsupported potential value.');
  }
  return value.toDouble();
}

void validateValueRange(double low, double typical, double high) {
  if (!validValueRange(low, typical, high)) {
    throw const FormatException('Invalid potential value range.');
  }
}

double safeValueTotal(Iterable<double> values) {
  var total = 0.0;
  for (final value in values) {
    total += estimateNumber(value);
    if (!total.isFinite || total > 9007199254740991) {
      throw const FormatException('Unsupported potential total.');
    }
  }
  return total;
}
