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
        string s = "askfj lkj";
        return s.c_str();
    }
    EMSCRIPTEN_KEEPALIVE
    void add(long long x) {
        cout << x << endl;
    }
}