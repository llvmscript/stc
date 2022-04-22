#ifndef LLVMSCRIPT_STRING_H
#define LLVMSCRIPT_STRING_H

#include <stdint.h>

typedef struct {
  uint8_t* data;
  uint32_t length;
} String;

#endif
