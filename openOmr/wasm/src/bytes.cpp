#include <cstdint>
#include <vector>
#include <emscripten/bind.h>
#include <emscripten/val.h>

// Borrowed view: callers must copy immediately, before resizing/deleting the
// vector or invoking another WASM operation which can grow linear memory.
emscripten::val byteVectorView(std::vector<std::uint8_t>& bytes) {
    return emscripten::val(emscripten::typed_memory_view(bytes.size(), bytes.data()));
}

EMSCRIPTEN_BINDINGS(OpenOmrWasm_bytes) {
    emscripten::function("byteVectorView", &byteVectorView);
}