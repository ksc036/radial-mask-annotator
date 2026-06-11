# TypeScript Target Compatible Tests

When test code is compiled by `tsc`, avoid newer JavaScript helpers unless the project's `lib` target includes them. Prefer target-compatible loops or helpers over APIs like `Array.prototype.findLast` when the repository build target is older than the API.

For DOM fakes, avoid typing test doubles as full browser interfaces when the real method has overloaded signatures. Define a narrow local interface with only the methods the production helper calls, then cast the fake context to the narrow return type.
