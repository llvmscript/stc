#include <stdlib.h>
#include <stdint.h>

void* gc__allocate(uint32_t bytes) {
  return malloc(bytes);
}

void* gc__reallocate(void* ptr, uint32_t bytes) {
  return realloc(ptr, bytes);
}
