function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

export default assert
