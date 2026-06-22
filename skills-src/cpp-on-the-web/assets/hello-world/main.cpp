#include <emscripten/bind.h>
#include <iostream>

std::string sayHello(std::string name) {
    return "Hello, " + name + " from C++!";
}

EMSCRIPTEN_BINDINGS(hello_module) {
    emscripten::function("sayHello", &sayHello);
}

int main() {
    std::cout << "C++ Module Loaded!" << std::endl;
    return 0;
}
