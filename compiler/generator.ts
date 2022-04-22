import { Scope, TypeStack } from "./core";
import ts from "typescript";
import llvm from "llvm-bindings";
import assert from "assert";
import { manglePropertyAccess } from "./utils/mangle";
import { emitStdlibCall } from "./stdlib";
import { getEnumKeyByEnumValue } from "./utils/misc";

export const generateLLVM = (program: ts.Program): llvm.Module => {
  const context = new llvm.LLVMContext();
  const module = new llvm.Module("main", context);
  const generator = new LLVMGenerator(program, module, context);
  const { builder } = generator;

  // ensure lib/stc.d.ts is included
  const stdlibDef = generator.program.getSourceFile("lib/stc.d.ts");
  assert(stdlibDef, "FATAL: Could not find stc type definitions");

  // llvm: create the main function
  const fmain = llvm.Function.Create(
    llvm.FunctionType.get(generator.builder.getInt32Ty(), [], false),
    llvm.Function.LinkageTypes.ExternalLinkage,
    "main",
    generator.module
  );
  llvm.BasicBlock.Create(generator.context, "entry", fmain);

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName === "test/main.ts") {
      generator.genFromSourceFile(sourceFile);
    }
  }

  builder.SetInsertPoint(fmain.getExitBlock());
  builder.CreateRet(builder.getInt32(0));

  try {
    llvm.verifyModule(module);
  } catch (error) {
    (error as Error).message += `\n${module.print()}`;
    throw error;
  }

  return module;
};

/**
 * A generator which lets you generate LLVM IR from TypeScript AST nodes
 *
 * It's structured into a class so that it can be passed-
 * around from a single construction.
 */
export class LLVMGenerator {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly module: llvm.Module;
  readonly context: llvm.LLVMContext;
  readonly builder: llvm.IRBuilder;
  readonly stack: TypeStack;
  readonly emitter: IREmitter;

  constructor(
    program: ts.Program,
    module: llvm.Module,
    context: llvm.LLVMContext
  ) {
    this.program = program;
    this.checker = program.getTypeChecker();
    this.module = module;
    this.context = context;
    this.builder = new llvm.IRBuilder(context);
    this.stack = new TypeStack();
    this.emitter = new IREmitter(this);
  }

  /**
   * Generates LLVM IR from a {@link ts.SourceFile}.
   *
   * This is sort of the "main" function for the generator
   * that parses the entire file and generates the
   * LLVM IR.
   */
  genFromSourceFile(sourceFile: ts.SourceFile) {
    sourceFile.forEachChild((node) =>
      this.emitNode(node, this.stack.globalScope)
    );
  }

  /**
   * Handles different types of nodes differently
   * and generates the equivalent IR for them.
   */
  emitNode(node: ts.Node, scope: Scope): void {
    /* handle global expressions on the top level of the file
       by setting the insert point to the main function, where
       it can put all this stuff there. */
    if (scope === this.stack.globalScope) {
      switch (node.kind) {
        case ts.SyntaxKind.Block:
        case ts.SyntaxKind.ExpressionStatement:
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.ReturnStatement:
        case ts.SyntaxKind.VariableStatement: {
          const mainFunc = this.module.getFunction("main");
          assert(mainFunc, `Main function not found.`);
          /* TODO: change this to use the last basic block
                   of the main function.
                   Function.getBasicBlocks() is not supported by the bindings yet.*/
          this.builder.SetInsertPoint(mainFunc.getEntryBlock());
        }
      }
    }

    switch (node.kind) {
      case ts.SyntaxKind.Block: {
        assert(ts.isBlock(node));
        this.emitter.emitBlock(node);
        break;
      }
      case ts.SyntaxKind.ExpressionStatement: {
        assert(ts.isExpressionStatement(node));
        this.emitter.emitExpressionStatement(node);
        break;
      }
      case ts.SyntaxKind.EndOfFileToken: {
        break;
      }
      default: {
        console.warn(
          `Unhandled ts.Node '${ts.SyntaxKind[node.kind]}': ${node.getText()}`
        );
      }
    }
  }
}

/**
 * IREmitter
 */
export class IREmitter {
  readonly generator: LLVMGenerator;

  constructor(generator: LLVMGenerator) {
    this.generator = generator;
  }

  emitBlock(block: ts.Block) {
    this.generator.stack.withScope((scope) => {
      for (const statement of block.statements) {
        this.generator.emitNode(statement, scope);
      }
    });
  }

  emitExpressionStatement(statement: ts.ExpressionStatement): void {
    /*
    NOTE: This is just to get console.log to work, in future we have
    to turn all these ifs into things that calls IR generation
    functions that handle each specific expression kind.
    */

    if (ts.isCallExpression(statement.expression)) {
      this.emitCallExpression(statement.expression);
    }

    /*
    TODO: Support language builtins like String.prototype.length, String.prototype.join
    */
  }

  emitCallExpression(expression: ts.CallExpression) {
    emitStdlibCall(expression, this.generator);

    let funcName: string = expression.expression.getText();
    if (ts.isPropertyAccessExpression(expression.expression)) {
      funcName = this.handlePropertyAccessExpression(expression.expression);
    }

    const callArgs: llvm.Value[] = [];
    for (const arg of expression.arguments) {
      const type = this.generator.checker.getTypeAtLocation(arg);
      if (type.isLiteral()) {
        this.emitLiteralConstant(type);
      } else {
        this.emitVariableObject(type);
      }
    }

    // const args = expression.arguments;
    // let funcName: string;
    // if (ts.isPropertyAccessExpression(expression.expression)) {
    //   funcName = this.handlePropertyAccessExpression(expression.expression);
    // } else {
    //   funcName = expression.expression.getText();
    // }

    // // get call arguments + types
    // const callArgs: llvm.Value[] = [];
    // for (const arg of args) {
    //   const type = this.generator.checker.getTypeAtLocation(arg);
    //   if (type.isStringLiteral()) {
    //     callArgs.push(
    //       this.generator.builder.CreateGlobalStringPtr(
    //         arg.getText(),
    //         "",
    //         0,
    //         this.generator.module
    //       )
    //     );
    //   } else if (type.isNumberLiteral()) {
    //     callArgs.push(
    //       llvm.ConstantFP.get(
    //         this.generator.builder.getFloatTy(),
    //         parseFloat(arg.getText())
    //       )
    //     );
    //   }
    // }
    // const callArgsTypes: llvm.Type[] = callArgs.map((i) => i.getType());

    // /* we have to look at the call site to "guess" the function type.
    //    if we can't guess it, we have to throw an error. */
    // let llFuncReturnType: llvm.Type = this.generator.builder.getVoidTy();
    // if (expression.parent && ts.isVariableDeclaration(expression.parent)) {
    //   const returnType = this.generator.checker.getTypeAtLocation(
    //     expression.parent
    //   );

    //   switch (returnType.flags) {
    //     case ts.TypeFlags.Void:
    //       llFuncReturnType = this.generator.builder.getVoidTy();
    //       break;
    //     case ts.TypeFlags.String:
    //       llFuncReturnType = this.generator.builder.getInt8PtrTy();
    //       break;
    //     case ts.TypeFlags.Boolean:
    //       llFuncReturnType = this.generator.builder.getInt8Ty();
    //       break;
    //     case ts.TypeFlags.Number:
    //       llFuncReturnType = this.generator.builder.getFloatTy();
    //       break;
    //     default:
    //       throw new Error(`Unable to get function callee type`);
    //   }
    // }

    // const llFunc = this.generator.module.getOrInsertFunction(
    //   funcName,
    //   llvm.FunctionType.get(llFuncReturnType, callArgsTypes, false)
    // );
    // this.generator.builder.CreateCall(
    //   llFunc.getFunctionType(),
    //   llFunc.getCallee(),
    //   callArgs
    // );
  }

  emitLiteralConstant(type: ts.LiteralType): llvm.Constant {
    if (type.isStringLiteral()) {
      return this.generator.builder.CreateGlobalStringPtr(
        type.value,
        "",
        0,
        this.generator.module
      );
    }
    if (type.isNumberLiteral()) {
      return llvm.ConstantFP.get(
        this.generator.builder.getFloatTy(),
        type.value
      );
    }
    throw new Error(
      `Cannot emit invalid literal constant of type ${getEnumKeyByEnumValue(
        ts.TypeFlags,
        type.flags
      )}`
    );
  }

  emitVariableObject(type: ts.Type) {
    if (type.flags === ts.TypeFlags.String) {
      const stringType = llvm.StructType.create(
        this.generator.context,
        [
          this.generator.builder.getInt8PtrTy(),
          this.generator.builder.getInt32Ty(),
        ],
        "String"
      );
      const alloca = this.generator.builder.CreateAlloca(stringType);
      // const dataPtr = this.generator.builder.CreateInBoundsGEP(stringType, alloca, []);
      // const lengthPtr = this.generator.builder.CreateInBoundsGEP(stringType, )
      // this.generator.builder.CreateStore(
      //   this.generator.builder.CreateGlobalStringPtr(""),
      //   alloca
      // );
      // this.generator.builder.CreateStore(

      // )
    } else {
      throw new Error(
        `Cannot allocate memory for invalid type ${getEnumKeyByEnumValue(
          ts.TypeFlags,
          type.flags
        )}`
      );
    }
  }

  handlePropertyAccessExpression(
    expression: ts.PropertyAccessExpression
  ): string {
    // straight up just turn the whole thing into a mangled string lol
    return manglePropertyAccess(expression.getText());
  }
}
