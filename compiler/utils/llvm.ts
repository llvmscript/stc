import assert from "assert";
import llvm from "llvm-bindings";

// export const getLLVMFunction = (
//   module: llvm.Module,
//   funcName: string
// ): llvm.Function => {
//   const func = module.getFunction(funcName);
//   assert(func, `Function ${funcName} is not declared/defined!`);
//   return func;
// };

export const keepInsertionPoint = <T>(
  builder: llvm.IRBuilder,
  emit: () => T
): T => {
  const savedIP = builder.GetInsertBlock();
  assert(savedIP, `Failed to get insert block`);
  const result = emit();
  builder.SetInsertPoint(savedIP);
  return result;
};
