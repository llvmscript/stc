import llvm from "llvm-bindings";
import * as Core from "./core";

export class LLVM {
  context: llvm.LLVMContext;
  module: llvm.Module;
  builder: llvm.IRBuilder;

  constructor(moduleName: string) {
    this.context = new llvm.LLVMContext();
    this.module = new llvm.Module(moduleName, this.context);
    this.builder = new llvm.IRBuilder(this.context);
  }
}

export const defineFunc = (
  ll: LLVM,
  name: string,
  returnType: Core.Type,
  paramTypes: Core.Type[],
  implement: (ll: LLVM, func: llvm.Function) => void
) => {
  const prevInsertBlock = ll.builder.GetInsertBlock();

  const func = llvm.Function.Create(
    llvm.FunctionType.get(
      Core.Type.toLLVMType(ll.context, returnType),
      paramTypes.map((paramType) =>
        Core.Type.toLLVMType(ll.context, paramType)
      ),
      false
    ),
    llvm.Function.LinkageTypes.ExternalLinkage,
    name,
    ll.module
  );
  const entryBB = llvm.BasicBlock.Create(ll.context, "entry", func);
  ll.builder.SetInsertPoint(entryBB);

  implement(ll, func);

  if (prevInsertBlock) ll.builder.SetInsertPoint(prevInsertBlock);
};
