import llvm from "llvm-bindings";
import { defineFunc, LLVM } from "./llvm";
import * as Core from "./core";
import assert from "assert";

/**
 * This adds libc
 */
const addLibc = (ll: LLVM) => {
  // -- puts --
  const fputs = llvm.Function.Create(
    llvm.FunctionType.get(
      ll.builder.getInt32Ty(),
      [ll.builder.getInt8PtrTy()],
      false
    ),
    llvm.Function.LinkageTypes.ExternalLinkage,
    "puts",
    ll.module
  );
  fputs.setDoesNotThrow();

  // -- fflush --
  const ioFileStruct = llvm.StructType.create(ll.context, "struct._IO_FILE");
  const fflush = llvm.Function.Create(
    llvm.FunctionType.get(
      ll.builder.getInt32Ty(),
      [ioFileStruct.getPointerTo()],
      false
    ),
    llvm.Function.LinkageTypes.ExternalLinkage,
    "fflush",
    ll.module
  );

  // -- printf --
  const printf = llvm.Function.Create(
    llvm.FunctionType.get(
      ll.builder.getInt32Ty(),
      [ll.builder.getInt8PtrTy()],
      true
    ),
    llvm.Function.LinkageTypes.ExternalLinkage,
    "printf",
    ll.module
  );
};

/**
 * This object contains the implementations for the standard library.
 * What this means, is that the functions below should run independently
 * and generate the entire standard library.
 *
 * The only reasons why these are placed in objects is for clarity and
 * brevity.
 */
const stdlib = {
  console: {
    /**
     * Log a string to stdout, taking the arguments from the stack.
     */
    log(ll: LLVM) {
      const fputs = ll.module.getFunction("puts");
      assert(fputs, `@puts not found in module definition`);
      const fflush = ll.module.getFunction("fflush");
      assert(fflush, `@fflush not found in module definition`);
      const printf = ll.module.getFunction("fflush");
      assert(printf, `@fflush not found in module definition`);

      defineFunc(
        ll,
        "console_log",
        Core.Type.i32,
        [Core.Type.string],
        (ll, func) => {
          const fputsCall = ll.builder.CreateCall(fputs, [func.getArg(0)]);
          ll.builder.CreateRet(fputsCall);
        }
      );
    },

    /* TODO: need to find some way to get stderr in LLVM
             or implement the syscalls manually
             
             edit: i could do this with dprintf, which
             prints to the file descriptor.
             on unix this should be as follows:
              stdout: 0
              stdin: 1
              stderr: 2                                
    */
    // error(ll: LLVM) {
    //   const puts = ll.module.getFunction("puts")
    //   assert(puts, `@puts not found in module definition`);
    // },
  },
};

export const generateStdlib = (ll: LLVM) => {
  addLibc(ll);
  for (const key in stdlib.console) {
    stdlib.console[key as keyof typeof stdlib.console](ll);
  }
};
