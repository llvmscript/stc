import { Scope, TypeStack } from "./core";
import ts from "typescript";
import llvm from "llvm-bindings";
import assert from "assert";

const keepInsertionPoint = <T>(builder: llvm.IRBuilder, emit: () => T): T => {
  const savedIP = builder.GetInsertBlock();
  assert(savedIP, `Failed to get insert block`);
  const result = emit();
  builder.SetInsertPoint(savedIP);
  return result;
};

export const generateLLVM = (program: ts.Program): llvm.Module => {
  const checker = program.getTypeChecker();
  const context = new llvm.LLVMContext();
  const module = new llvm.Module("main", context);
  const generator = new LLVMGenerator(checker, module, context);
  const { builder } = generator;

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
  } catch (error: any) {
    error.message += `\n${module.print()}`;
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
  readonly checker: ts.TypeChecker;
  readonly module: llvm.Module;
  readonly context: llvm.LLVMContext;
  readonly builder: llvm.IRBuilder;
  readonly stack: TypeStack;
  readonly emitter: IREmitter;

  constructor(
    checker: ts.TypeChecker,
    module: llvm.Module,
    context: llvm.LLVMContext
  ) {
    this.checker = checker;
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

  emitExpressionStatement(statement: ts.ExpressionStatement) {
    if (ts.isCallExpression(statement.expression)) {
    }
    this.generator.stack.withScope((scope) => {});
  }
}
