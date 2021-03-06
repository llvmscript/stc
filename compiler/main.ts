import llvm from "llvm-bindings";
import ts from "typescript";
import { execFileSync } from "child_process";
import fs from "fs";
import { Command } from "commander";
import assert from "assert";
import { generateLLVM } from "./generator";
import path from "path";
import { printAST, printASTKinds } from "./utils/typescript";

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
  const clangArgs = [
    "-O3",
    ...runtimeLibFiles,
    irFileName,
    "-o",
    executableFileName,
    "--std=c11",
  ];

  try {
    execFileSync("clang", clangArgs);
  } catch {
    console.log("\nclang failed to compile.");
    console.log("Running clang again with verbose output...");
    execFileSync("clang", [...clangArgs, "-v"]);
  }
};

const main = () => {
  const tsCompilerOptions: ts.CompilerOptions = {
    types: [],
    strict: true,
  };
  const host = ts.createCompilerHost(tsCompilerOptions);
  const program = ts.createProgram(
    ["test/main.ts", "lib/stc.d.ts"],
    tsCompilerOptions,
    host
  );
  const testFile = program.getSourceFile("test/main.ts");
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
    process.exit(1);
  }

  console.log("\n--- TYPESCRIPT AST OUTPUT ---\n");
  printAST(testFile as ts.Node);
  console.log("\n--- TYPESCRIPT AST KINDS ---\n");
  printASTKinds(testFile as ts.Node);

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
