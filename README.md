# stc

Compiler for llvmscript, an attempt to compile TypeScript into native machine code.

Goal: Compile TypeScript PI calculator into a native ELF LSB pie executable

### Developing

Dependencies: `llvm` `cmake`

On macOS you may need to run this for llvm-bindings to be able to find llvm.

```shell
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
export LDFLAGS="-L/opt/homebrew/opt/llvm/lib"
export CPPFLAGS="-I/opt/homebrew/opt/llvm/include"
```

Getting LLVM generated code from a c file:

```
llvm-gcc -S -emit-llvm llvm/hello-world.c -o /dev/stdout
```

## Development Notes

### Variables & Types

[TODO]

### Why

what better way to learn more about compilers than to actually build one
