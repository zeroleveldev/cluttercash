import 'dart:js_interop';

@JS('cluttercashSubscriberTake')
external JSString? _take();
@JS('cluttercashSubscriberRead')
external JSString? _read(JSString key);
@JS('cluttercashSubscriberWrite')
external void _write(JSString key, JSString? value);
String? takeSubscriberLanding() => _take()?.toDart;
String? readSubscriberValue(String key) => _read(key.toJS)?.toDart;
void writeSubscriberValue(String key, String? value) =>
    _write(key.toJS, value?.toJS);
