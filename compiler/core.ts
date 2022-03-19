import llvm from "llvm-bindings";
import assert from "assert";
import ts from "typescript";
import { LLVM } from "./llvm";

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

// export interface Variable {
//   type: Type; // strictly not optional
//   name?: string;
//   value?: llvm.Value;
// }

// export interface Constant {
//   type: Type;
//   name?: string; // might remove this
//   value?: llvm.Constant;
//   sourceValue: string | number;
// }

/**
 * ScopeData contains a declaration because it is meant for object
 * types.
 */
interface ScopeData {
  readonly declaration: ts.ClassDeclaration | ts.InterfaceDeclaration;
  readonly type: llvm.StructType;
}

/**
 * A Scope can either contain an llvm.Value or itself.
 * This is to allow nested scopes, where a scope can be
 * inside another scope.
 */
type ScopeValue = llvm.Value | Scope;

export class Scope extends Map<string, ScopeValue> {
  readonly name?: string;
  readonly data?: ScopeData;

  constructor(name?: string, data?: ScopeData) {
    super();
    this.name = name;
    this.data = data;
  }

  get(identifier: string): ScopeValue {
    const value = super.get(identifier);
    assert(value, `Unknown identifier '${identifier}'`);
    return value;
  }

  getScope(identifier: string): Scope {
    const scope = this.get(identifier) as Scope;
    assert(scope instanceof Scope, `Identifier '${identifier}' is not a scope`);
    return scope;
  }

  getValue(identifier: string): llvm.Value {
    const value = this.get(identifier) as llvm.Value;
    assert(
      value instanceof llvm.Value,
      `Identifier '${identifier}' is not a value`
    );
    return value;
  }

  set(identifier: string, value: ScopeValue) {
    assert(
      !this.has(identifier),
      `Overwriting identifier '${identifier}' in scope is not allowed.
       call Scope.overwrite() instead.`
    );
    return super.set(identifier, value);
  }

  overwrite(identifier: string, value: ScopeValue) {
    assert(
      this.has(identifier),
      `Identifier '${identifier}' not found in scope`
    );
    return super.set(identifier, value);
  }
}

/**
 * The stack that keeps track of the objects in the whole file.
 *
 * Everything in JS is an object, and that's how we should
 * handle it as.
 */
export class TypeStack {
  private readonly scopes: Scope[];

  constructor() {
    this.scopes = [new Scope()];
  }

  get(identifier: string): ScopeValue {
    const parts = identifier.split("."); // JS object property accessor is a dot notation

    // if it is accessing a property of an object
    if (parts.length > 1) {
      // we get the scope of the base object
      // console.log -> console
      const scope = this.get(parts[0]);
      assert(scope instanceof Scope, `'${parts[0]}' is not a namespace`);
      // get the scope of the properties inside the base object
      // foo.bar.baz -> bar.baz
      return scope.get(parts.slice(1).join("."));
    }

    // if it isn't a property access but simply an object with a scope
    for (const scope of [...this.scopes].reverse()) {
      const value = scope.get(identifier);
      assert(value, `Unknown identifier '${identifier}'`);
      return value;
    }

    // if it gets here you know you fucked up
    assert(false, `Unknown identifier '${identifier}'`);
  }

  get globalScope(): Scope {
    return this.scopes[0];
  }

  get currentScope(): Scope {
    return this.scopes[this.scopes.length - 1];
  }

  withScope(body: (scope: Scope) => void, scopeName?: string): void {
    const scope = new Scope(scopeName);
    this.scopes.push(scope);
    body(scope);
    this.scopes.pop();
  }
}
