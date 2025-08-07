project(NitroEventSource)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME NitroEventSource)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

# Paths
set(ARCH ${ANDROID_ABI})
set(PREBUILT_PATH "${PROJECT_SOURCE_DIR}/../third_party/curl/android/${ARCH}")
set(CURL_INCLUDE_DIR "${PREBUILT_PATH}/include")
set(OPENSSL_INCLUDE_DIR "${PREBUILT_PATH}/include/openssl")

# Include headers
include_directories(
    "${CURL_INCLUDE_DIR}"
    "${OPENSSL_INCLUDE_DIR}"
    "src/main/cpp"
    "../cpp"
)

# Add prebuilt libraries
add_library(curl STATIC IMPORTED)
set_target_properties(curl PROPERTIES IMPORTED_LOCATION "${PREBUILT_PATH}/libcurl.a")

add_library(ssl STATIC IMPORTED)
set_target_properties(ssl PROPERTIES IMPORTED_LOCATION "${PREBUILT_PATH}/libssl.a")

add_library(crypto STATIC IMPORTED)
set_target_properties(crypto PROPERTIES IMPORTED_LOCATION "${PREBUILT_PATH}/libcrypto.a")

# Define your main shared library
add_library(${PACKAGE_NAME} SHARED 
    src/main/cpp/cpp-adapter.cpp
    ../cpp/HybridNitroEventSource.cpp
    ../cpp/HybridNitroEventSource.hpp
)

# Auto-linking for RN
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroEventSource+autolinking.cmake)

# System libs
find_library(LOG_LIB log)
find_library(ANDROID_LIB android)

# Link everything
target_link_libraries(${PACKAGE_NAME}
    curl
    ssl
    crypto
    ${LOG_LIB}
    ${ANDROID_LIB}
)
