import llvm from "llvm-bindings";
import { defineFunc, LLVM } from "./llvm";
import * as Core from "./core";
import assert from "assert";
import { LLVMGenerator } from "./generator";
import ts from "typescript";
import path from "path";
import fs from "fs";
import { manglePropertyAccess } from "./utils/mangle";
import { getEnumKeyByEnumValue } from "./utils/misc";

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

/**
 * We need this Stdlib class because there is no way to ensure
 * strong type safety just by linking the runtime C files with
 * the program.
 *
 * TODO: We do not need this class any more, we should define the
 *       types for the stdlib in stc.d.ts and only expose usable
 *       functions.
 *       We have to then use the definitions to check for
 *       incorrect types via ts.TypeChecker
 */
export class Stdlib {
  private generator: LLVMGenerator;

  constructor(generator: LLVMGenerator) {
    this.generator = generator;
  }

  getRuntimeLibPaths(): string[] {
    const runtimeLibPath = path.join(__dirname, "..", "lib", "runtime");
    return fs
      .readdirSync(runtimeLibPath)
      .filter((file) => path.extname(file) === ".c")
      .map((file) => path.join(runtimeLibPath, file));
  }

  fcall(name: string, args: ts.NodeArray<ts.Expression>): boolean {
    switch (name) {
      // this name should be a 1:1 of the defined name in lib/runtime
      case "console__log": {
        const tsArg = args[0];
        const argType = this.generator.checker.getTypeAtLocation(tsArg);
        let arg: string = tsArg.getText();
        if (!argType.isStringLiteral()) {
          console.log(
            `WARN: Casting argument of type ${argType.flags} to string`
          );

          // cast argument to string
          arg = String(arg);
        }
        const callArg = this.generator.builder.CreateGlobalStringPtr(
          arg,
          "",
          0,
          this.generator.module
        );
        const llFunc = this.generator.module.getOrInsertFunction(
          name,
          llvm.FunctionType.get(
            this.generator.builder.getInt8PtrTy(),
            [callArg.getType()],
            false
          )
        );
        this.generator.builder.CreateCall(
          llFunc.getFunctionType(),
          llFunc.getCallee(),
          [callArg]
        );
        return true;
      }
      default:
        console.log(
          `INFO: Using function that isn't defined in Stdlib 'fcall' => ${name}`
        );
    }

    return true;
  }
}

export const emitStdlibCall = (
  expr: ts.Expression,
  generator: LLVMGenerator
): llvm.CallInst => {
  if (ts.isCallExpression(expr)) {
    const funcName = manglePropertyAccess(expr.expression.getText());
    switch (funcName) {
      case "console__log": {
        const callArgs: llvm.Value[] = [];
        for (const arg of expr.arguments) {
          const type = generator.checker.getTypeAtLocation(arg);
          let value: string | null = null;

          if (type.isStringLiteral()) {
            value = type.value;
          }
          if (type.isNumberLiteral()) {
            console.warn(
              `WARN: Casting variable of ${getEnumKeyByEnumValue(
                ts.TypeFlags,
                type.flags
              )} type to string`
            );
            value = type.value.toString();
          }
          assert(
            value,
            `Cannot use variable of unknown type ${getEnumKeyByEnumValue(
              ts.TypeFlags,
              type.flags
            )}`
          );

          callArgs.push(
            generator.builder.CreateGlobalStringPtr(
              value,
              "",
              0,
              generator.module
            )
          );
        }

        const llFunc = generator.module.getOrInsertFunction(
          funcName,
          llvm.FunctionType.get(
            generator.builder.getVoidTy(),
            callArgs.map((i) => i.getType()),
            false
          )
        );

        return generator.builder.CreateCall(
          llFunc.getFunctionType(),
          llFunc.getCallee(),
          callArgs
        );
      }
    }
  }

  throw new Error(
    `ERROR: Trying to use undeclared stdlib expression: ${expr.getText()}`
  );
};
