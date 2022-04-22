#include <stdio.h>

void console__log(const char *str) {
  fputs(str, stdout);
  fputs("\n", stdout);
}

void console__error(const char *str) {
  fputs(str, stderr);
  fputs("\n", stderr);
}
