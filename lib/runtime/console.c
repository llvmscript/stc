#include <stdio.h>

void console__log(const char *str) {
  fputs(str, stdout);
}

void console__error(const char *str) {
  fputs(str, stderr);
}
