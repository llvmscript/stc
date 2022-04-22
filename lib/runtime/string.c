#include <string.h>
#include <stdint.h>
#include <stdlib.h>
#include "string.h"
#include "gc.h"

String string__concat(String a, String b) {
  uint32_t length = a.length + b.length;
  uint8_t* data = gc__allocate(length);
  memcpy(data, a.data, a.length);
  
  return (String) { length, data };
}

String string__constructor(const char* data) {
  uint32_t length = 0;
  for (int i = 0; i < strlen(data); i++) {
    length++;
  }
  uint8_t* data = gc__allocate(length);
  memcpy(data, data, length);
  
  return (String) { length, data };
}

