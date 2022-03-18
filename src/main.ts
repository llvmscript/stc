import { generateStdlib } from "./stdlib";
import { LLVM } from "./llvm";
import llvm from "llvm-bindings";
import ts from "typescript";
import { execSync } from "child_process";
import fs from "fs";
import { program } from "commander";
import assert from "assert";
import * as Core from "./core";

const filename = "hello-world.ts";
const code = `
console.log("helo world");
`;

program.parse();

/**
 * Creates a global constant and pushes it into TypeStack.constants
 */
const createGlobalConstant = (
  ll: LLVM,
  constant: Core.Constant
): Core.Constant => {
  // return previously defined constant if found
  const reusedConstant = Core.GLOBAL_STACK.constantReuse(constant);
  if (reusedConstant) return reusedConstant;

  switch (constant.type) {
    case Core.Type.string: {
      const ptr = ll.builder.CreateGlobalStringPtr(
        constant.sourceValue as string,
        `.str.${Core.GLOBAL_STACK.constantCount}`,
        0,
        ll.module
      );
      const createdConstant: Core.Constant = {
        name: `.str.${Core.GLOBAL_STACK.constantCount}`,
        type: Core.Type.string,
        value: ptr,
        sourceValue: constant.sourceValue,
      };
      Core.GLOBAL_STACK.constantPush(createdConstant);
      return createdConstant;
    }
  }
  assert(
    false,
    `createGlobalConstant for ${constant.type} is not implemented yet.`
  );
};

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
const handleGlobals = (ll: LLVM, sourceFile: ts.SourceFile) => {
  const findGlobals = (node: ts.Node) => {
    if (ts.isBlock(node)) {
      Core.GLOBAL_STACK.push({
        variables: [],
        value: llvm.BasicBlock.Create(ll.context),
      });
    }

    if (ts.isCallExpression(node)) {
      // push the argument onto the stack
      if (ts.isStringLiteral(node.arguments[0])) {
        const constant = createGlobalConstant(ll, {
          type: Core.Type.string,
          sourceValue: node.arguments[0].text,
        });
        Core.GLOBAL_STACK.pushVar({
          type: Core.Type.string,
          value: constant.value,
        });
      }
      if (ts.isPropertyAccessExpression(node.expression)) {
        const entryBB = ll.module.getFunction("main")!.getEntryBlock();
        ll.builder.SetInsertPoint(entryBB);
        const arg = Core.GLOBAL_STACK.popVar();
        assert(arg, "No variable found on the stack");
        assert(arg.value, "Invalid variable at the top of the stack");
        ll.builder.CreateCall(
          ll.module.getFunction(
            node.expression.getText(sourceFile).replace(".", "_")
          )!,
          [arg.value]
        );
      }
    }
    ts.forEachChild(node, findGlobals);
  };
  findGlobals(sourceFile);
};

const main = async () => {
  const node = ts.createSourceFile("x.ts", code, ts.ScriptTarget.Latest);
  printJSON(node);

  let moduleName = filename;
  if (filename.endsWith(".ts")) {
    moduleName = filename.substring(0, filename.length - 3);
  }
  const ll = new LLVM(moduleName);

  // llvm: create the main function
  const fmain = llvm.Function.Create(
    llvm.FunctionType.get(ll.builder.getInt32Ty(), [], false),
    llvm.Function.LinkageTypes.ExternalLinkage,
    "main",
    ll.module
  );
  const fmainEntryBlock = llvm.BasicBlock.Create(ll.context, "entry", fmain);
  ll.builder.SetInsertPoint(fmainEntryBlock);
  // create global scope
  Core.GLOBAL_STACK.push({ value: fmainEntryBlock, variables: [] });

  printJSON(node);

  generateStdlib(ll);
  handleGlobals(ll, node);

  ll.builder.CreateRet(ll.builder.getInt32(0));

  printTS(node);
  console.log(ll.module.print());

  // compile the program
  if (llvm.verifyModule(ll.module)) {
    console.error("Verifying module failed");
    return;
  }
  fs.writeFileSync(`${moduleName}.ll`, ll.module.print());
  execSync(`clang ${moduleName}.ll -o ./a.out`);
};

main();
