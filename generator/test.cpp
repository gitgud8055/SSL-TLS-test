#include <emscripten/emscripten.h>
#include <emscripten/val.h>
#include <iostream>
#include<vector>
#include<string>

using namespace std;

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void processString(const char* str) {
        std::cout << "Received string: " << str << std::endl;
    }
    EMSCRIPTEN_KEEPALIVE
    const char* Str() {
        return "askfj lkj";
    }
    EMSCRIPTEN_KEEPALIVE
    void add(emscripten::val_array a) {
        int res = a.as<int> ();
        cout << res << endl;
    }
}