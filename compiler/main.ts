import llvm from "llvm-bindings";
import ts from "typescript";
import { execFileSync } from "child_process";
import fs from "fs";
import { Command } from "commander";
import assert from "assert";
import { inspect } from "util";
import { generateLLVM } from "./generator";
import path from "path";

const argv = new Command();

argv.option("--target, -t").option("--print-ir, -p").option("--emit-ir");

// /**
//  * Creates a global constant and pushes it into TypeStack.constants
//  */
// const createGlobalConstant = (
//   ll: LLVM,
//   constant: Core.Constant
// ): Core.Constant => {
//   // return previously defined constant if found
//   const reusedConstant = Core.GLOBAL_STACK.constantReuse(constant);
//   if (reusedConstant) return reusedConstant;

//   switch (constant.type) {
//     case Core.Type.string: {
//       const ptr = ll.builder.CreateGlobalStringPtr(
//         constant.sourceValue as string,
//         `.str.${Core.GLOBAL_STACK.constantCount}`,
//         0,
//         ll.module
//       );
//       const createdConstant: Core.Constant = {
//         name: `.str.${Core.GLOBAL_STACK.constantCount}`,
//         type: Core.Type.string,
//         value: ptr,
//         sourceValue: constant.sourceValue,
//       };
//       Core.GLOBAL_STACK.constantPush(createdConstant);
//       return createdConstant;
//     }
//   }
//   assert(
//     false,
//     `createGlobalConstant for ${constant.type} is not implemented yet.`
//   );
// };

const printTS = (node: ts.SourceFile): void => {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const result = printer.printNode(ts.EmitHint.Unspecified, node, node);

  console.log(result);
};

// /**
//  * Recursively go into each expression and tell the builder
//  * to generate the equivalent code for global objects
//  */
// const handleGlobals = (ll: LLVM, sourceFile: ts.SourceFile) => {
//   const findGlobals = (node: ts.Node) => {
//     if (ts.isBlock(node)) {
//       Core.GLOBAL_STACK.push({
//         variables: [],
//         value: llvm.BasicBlock.Create(ll.context),
//       });
//     }

//     if (ts.isCallExpression(node)) {
//       // push the argument onto the stack
//       if (ts.isStringLiteral(node.arguments[0])) {
//         const constant = createGlobalConstant(ll, {
//           type: Core.Type.string,
//           sourceValue: node.arguments[0].text,
//         });
//         Core.GLOBAL_STACK.pushVar({
//           type: Core.Type.string,
//           value: constant.value,
//         });
//       }
//       if (ts.isPropertyAccessExpression(node.expression)) {
//         const entryBB = ll.module.getFunction("main")!.getEntryBlock();
//         ll.builder.SetInsertPoint(entryBB);
//         const arg = Core.GLOBAL_STACK.popVar();
//         assert(arg, "No variable found on the stack");
//         assert(arg.value, "Invalid variable at the top of the stack");
//         ll.builder.CreateCall(
//           ll.module.getFunction(
//             node.expression.getText(sourceFile).replace(".", "_")
//           )!,
//           [arg.value]
//         );
//       }
//     }
//     ts.forEachChild(node, findGlobals);
//   };
//   findGlobals(sourceFile);
// };

const replaceFileExtension = (filePath: string, extension: string): string => {
  return filePath.replace(/\.[^./\\]+$/, "") + extension;
};

const getOutputBaseName = (program: ts.Program): string => {
  const fileNames = program.getRootFileNames();
  // get the name of the "main" typescript file or use "main" instead
  return fileNames.length === 1 ? path.basename(fileNames[0], ".ts") : "main";
};

const writeIRToFile = (module: llvm.Module, program: ts.Program): string => {
  const fileName = replaceFileExtension(getOutputBaseName(program), ".ll");
  fs.writeFileSync(fileName, module.print());
  console.log(`${fileName} written`);
  return fileName;
};

const writeExecutableToFile = (
  module: llvm.Module,
  program: ts.Program
): void => {
  const runtimeLibPath = path.join(__dirname, "..", "lib", "runtime");
  const runtimeLibFiles = fs
    .readdirSync(runtimeLibPath)
    .filter((file) => path.extname(file) === ".c")
    .map((file) => path.join(runtimeLibPath, file));
  const irFileName = writeIRToFile(module, program);
  const executableFileName = replaceFileExtension(irFileName, ".out");

  try {
    execFileSync("clang", [
      "-O3",
      ...runtimeLibFiles,
      irFileName,
      "-o",
      executableFileName,
      "--std=c11",
    ]);
  } finally {
    // ignore errors
  }
};

const main = () => {
  const tsCompilerOptions: ts.CompilerOptions = {};
  const host = ts.createCompilerHost(tsCompilerOptions);
  const program = ts.createProgram(["test/main.ts"], tsCompilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
    process.exit(1);
  }

  console.log(
    inspect(program.getSourceFile("test/main.ts"), undefined, null, true)
  );

  llvm.InitializeAllTargetInfos();
  llvm.InitializeAllTargets();
  llvm.InitializeAllTargetMCs();
  llvm.InitializeAllAsmParsers();
  llvm.InitializeAllAsmPrinters();

  const llvmModule = generateLLVM(program);

  const compileTarget: string | undefined = argv.getOptionValue("target");
  if (compileTarget) {
    const target = llvm.TargetRegistry.lookupTarget(compileTarget);
    assert(target, `Target '${compileTarget}' not found`);
    const targetMachine = target.createTargetMachine(compileTarget, "generic");
    llvmModule.setDataLayout(targetMachine.createDataLayout());
    llvmModule.setTargetTriple(compileTarget);
  }

  const doPrintIR: boolean | undefined = argv.getOptionValue("print-ir");
  if (doPrintIR) {
    console.log(llvmModule.print());
  }

  const doEmitIR: boolean | undefined = argv.getOptionValue("emit-ir");
  if (doEmitIR) {
    writeIRToFile(llvmModule, program);
  }

  if (!doPrintIR && !doEmitIR) {
    writeExecutableToFile(llvmModule, program);
  }
};

main();
