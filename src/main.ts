import llvm from "llvm-bindings";
import ts from "typescript";
import { execSync } from "child_process";
import fs from "fs";

const filename = "hello-world.ts";
const code = `
console.log("helo world");
`;
let VARIABLE_COUNT_GLOBAL: number = 0;
let VARIABLE_STRING_PREFIX: string = ".str";

const printTS = (node: ts.SourceFile): void => {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const result = printer.printNode(ts.EmitHint.Unspecified, node, node);

  console.log(result);
};

const printJSON = (obj: any): void => {
  console.log(JSON.stringify(obj, undefined, 2));
};

/**
 * Recursively go into each expression and tell the builder
 * to generate the equivalent code for global objects
 */
const handleGlobals = (
  builder: llvm.IRBuilder,
  module: llvm.Module,
  node: ts.Node
) => {
  const findGlobals = (node: ts.Node) => {
    // check if node is function call
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      printJSON(node.expression);
      if (
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.escapedText === "console"
      ) {
        if (
          ts.isIdentifier(node.expression.name) &&
          node.expression.name.escapedText === "log"
        ) {
          // found console.log
          const fputs = llvm.Function.Create(
            llvm.FunctionType.get(
              builder.getInt32Ty(),
              [builder.getInt8PtrTy()],
              false
            ),
            llvm.Function.LinkageTypes.ExternalLinkage,
            "puts",
            module
          );
          fputs.setDoesNotThrow();

          const printArg = node.arguments[0];
          if (ts.isStringLiteral(printArg)) {
            VARIABLE_COUNT_GLOBAL++;
            const printConst = builder.CreateGlobalStringPtr(
              printArg.text,
              `${VARIABLE_STRING_PREFIX}.${VARIABLE_COUNT_GLOBAL}`,
              0,
              module
            );
            builder.CreateCall(fputs, [printConst]);
          }
        }
      }
    }
    ts.forEachChild(node, findGlobals);
  };
  findGlobals(node);
};

const main = async () => {
  const node = ts.createSourceFile("x.ts", code, ts.ScriptTarget.Latest);
  printJSON(node);

  let moduleName = filename;
  if (filename.endsWith(".ts")) {
    moduleName = filename.substring(0, filename.length - 3);
  }
  const llvmContext = new llvm.LLVMContext();
  const llvmModule = new llvm.Module(moduleName, llvmContext);
  const builder = new llvm.IRBuilder(llvmContext);

  // llvm: create the main function
  const mainFunc = llvm.Function.Create(
    llvm.FunctionType.get(builder.getInt32Ty(), [], false),
    llvm.Function.LinkageTypes.ExternalLinkage,
    "main",
    llvmModule
  );

  const entryBB = llvm.BasicBlock.Create(llvmContext, "entry", mainFunc);
  builder.SetInsertPoint(entryBB);

  printJSON(node);

  handleGlobals(builder, llvmModule, node);

  builder.CreateRet(builder.getInt32(0));

  printTS(node);
  console.log(llvmModule.print());

  // compile the program
  if (llvm.verifyModule(llvmModule)) {
    console.error("Verifying module failed");
    return;
  }
  fs.writeFileSync(`${moduleName}.ll`, llvmModule.print());
  execSync(`clang ${moduleName}.ll -o ./a.out`);
};

main();
