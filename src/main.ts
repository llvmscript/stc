import ts from "typescript";
import ast from "./ast-gen"
import gen_llvm from "./llvm/test"
import { create_for } from "./llvm/test";
import llvm from "llvm-bindings";

// gen_llvm(ast())
const result = ast();
if (!result) {
  throw Error(`File not found`)
}
const node = result.nodes;
const typeChecker = result.typeChecker;
console.log(gen_llvm(node, typeChecker).print())
// const context = new llvm.LLVMContext();
// const module = new llvm.Module("demo", context);
// const builder = new llvm.IRBuilder(context);

// const returnType = builder.getInt32Ty();
// const paramTypes = [builder.getInt32Ty(), builder.getInt32Ty()];
// const functionType = llvm.FunctionType.get(returnType, false);
// const func = llvm.Function.Create(
//   functionType,
//   llvm.Function.LinkageTypes.ExternalLinkage,
//   "main",
//   module
// );
// const fnStart = llvm.BasicBlock.Create(context, "fnStart", func);
// builder.SetInsertPoint(fnStart);
// create_for(node, builder, context, typeChecker);
// builder.CreateRet(builder.getInt32(0))

// console.log(module.print())