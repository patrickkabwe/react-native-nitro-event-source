#include <jni.h>
#include "NitroEventSourceOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::nitroeventsource::initialize(vm);
}
