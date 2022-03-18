import llvm from "llvm-bindings";
import assert from "assert";

/* prettier-ignore */
/**
 * The following types are expressed as such:
 *
 * <Name> = <From source code>
 *
 * These types are also used to unify the types for LLVM
 * function calls, because you can just pass the type
 * while knowing exactly what it will be, allowing
 * for easy conversion.
 *
 * For simplicity's sake, we shall only be implementing
 * number types from 16 bits to 64 bits.
 */
export enum Type {
  // PUBLIC
  string = "string",
  bool   = "boolean",
  i8     = "char",
  i16    = "i16",
  i32    = "i32",
  i64    = "i64",
  f16    = "f16",
  f32    = "f32",
  f64    = "f64",
  // PRIVATE
  i128   = "i128",
  f128   = "f128",
}
// There is no 8 bit floating point type in LLVM.

export namespace Type {
  export const parseString = (type: string): Type => {
    assert(type in Type);
    return type as Type;
  };

  export const toLLVMType = (
    context: llvm.LLVMContext,
    type: Type
  ): llvm.Type => {
    switch (type) {
      case Type.string:
        return llvm.ArrayType.getInt8PtrTy(context);
      case Type.bool:
        return llvm.Type.getInt1Ty(context);
      case Type.i8:
        return llvm.Type.getInt8Ty(context);
      case Type.i16:
        return llvm.Type.getInt16Ty(context);
      case Type.i32:
        return llvm.Type.getInt32Ty(context);
      case Type.i64:
        return llvm.Type.getInt64Ty(context);
      case Type.i128:
        return llvm.Type.getInt128Ty(context);
      case Type.f16:
        return llvm.Type.getHalfTy(context);
      case Type.f32:
        return llvm.Type.getFloatTy(context);
      case Type.f64:
        return llvm.Type.getDoubleTy(context);
      case Type.f128:
        return llvm.Type.getFP128Ty(context);
      default:
        throw new Error(`Cannot convert type '${type}' to LLVM equivalent`);
    }
  };
}

export interface Variable {
  type: Type; // strictly not optional
  name?: string;
  value?: llvm.Value;
}

export interface Constant {
  type: Type;
  name?: string; // might remove this
  value?: llvm.Constant;
  sourceValue: string | number;
}

export interface Scope {
  name?: string;
  value: llvm.BasicBlock;
  variables: Variable[];
}

export class TypeStack {
  private _stack: Scope[] = []; // should not be modifiable in any other way
  private _constants: Constant[] = []; // should only be pushed to

  get stackElementCount(): number {
    return this._stack.length;
  }

  push(scope: Scope): number {
    return this._stack.push(scope);
  }

  pop(): Scope | undefined {
    return this._stack.pop();
  }

  peek(): Scope | undefined {
    return this._stack[this._stack.length - 1];
  }

  pushVar(variable: Variable): number {
    const scope = this.peek();
    assert(scope, "No scope found on the top of the stack");

    return scope.variables.push(variable);
  }

  popVar(): Variable | undefined {
    const scope = this.peek();
    assert(scope, "No scope found on the top of the stack");

    return scope.variables.pop();
  }

  get constantCount(): number {
    return this._constants.length;
  }

  constantPush(constant: Constant): number {
    return this._constants.push(constant);
  }

  get constantTop(): Constant | undefined {
    return this._constants[this._constants.length - 1];
  }

  constantReuse(find: Constant): Constant | undefined {
    return this._constants.find(
      (constant) => constant.sourceValue === find.sourceValue
    );
  }
}

export const GLOBAL_STACK = new TypeStack();
