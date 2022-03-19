import ts, {
  BinaryExpression,
  ForStatement,
  FunctionDeclaration,
  Identifier,
  SyntaxKind,
  VariableDeclarationList,
} from "typescript";
import llvm from "llvm-bindings";

interface Var_List {
  [keys: string]: llvm.AllocaInst;
}

interface LooseType {
  [keys: string]: llvm.Type;
}

interface LooseValue {
  [keys: string]: Function;
}

const VARS: Var_List = {};

const TypeByName: LooseType = {};

const TypeValueByName: LooseValue = {};

const BinaryOperators: LooseValue = {};
const BinaryOperatorsFloat: LooseValue = {};

const UnaryOperators: LooseValue = {};
const UnaryOperatorsFloat: LooseValue = {};

const gen_llvm = (ast: ts.NodeArray<ts.Node>, typeChecker: ts.TypeChecker) => {
  const context = new llvm.LLVMContext();
  const module = new llvm.Module("demo", context);
  const builder = new llvm.IRBuilder(context);

  // TODO more types
  // Get type objects
  TypeByName.i16 = builder.getInt16Ty();
  TypeByName.i32 = builder.getInt32Ty();
  TypeByName.i64 = builder.getInt64Ty();
  // Get function to create value
  TypeValueByName.i16 = builder.getInt16.bind(builder);
  TypeValueByName.i32 = builder.getInt32.bind(builder);
  TypeValueByName.i64 = builder.getInt64.bind(builder);

  // TODO more operators (eg bitwise, add, subtract, etc)
  // TODO: add bool, char, float, etc
  // Get binary operators
  BinaryOperators[SyntaxKind.EqualsEqualsToken] =
    builder.CreateICmpEQ.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.EqualsEqualsToken] =
    builder.CreateFCmpOEQ.bind(builder);

  BinaryOperators[SyntaxKind.EqualsEqualsEqualsToken] =
    builder.CreateICmpEQ.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.EqualsEqualsEqualsToken] =
    builder.CreateFCmpOEQ.bind(builder);

  BinaryOperators[SyntaxKind.ExclamationEqualsToken] =
    builder.CreateICmpNE.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.ExclamationEqualsToken] =
    builder.CreateICmpNE.bind(builder);

  BinaryOperators[SyntaxKind.ExclamationEqualsEqualsToken] =
    builder.CreateICmpNE.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.ExclamationEqualsEqualsToken] =
    builder.CreateICmpNE.bind(builder);

  BinaryOperators[SyntaxKind.LessThanToken] =
    builder.CreateICmpSLT.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.LessThanToken] =
    builder.CreateFCmpOLT.bind(builder);

  BinaryOperators[SyntaxKind.LessThanEqualsToken] =
    builder.CreateICmpSLE.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.LessThanEqualsToken] =
    builder.CreateFCmpOLE.bind(builder);

  BinaryOperators[SyntaxKind.GreaterThanToken] =
    builder.CreateICmpSGT.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.GreaterThanToken] =
    builder.CreateFCmpOGT.bind(builder);

  BinaryOperators[SyntaxKind.GreaterThanEqualsToken] =
    builder.CreateICmpSGE.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.GreaterThanEqualsToken] =
    builder.CreateFCmpOGE.bind(builder);

  BinaryOperators[SyntaxKind.ExclamationToken] =
    builder.CreateNot.bind(builder);
  BinaryOperatorsFloat[SyntaxKind.ExclamationToken] =
    builder.CreateNot.bind(builder);

  // Unary!
  UnaryOperators[SyntaxKind.ExclamationToken] = builder.CreateNot.bind(builder);
  UnaryOperatorsFloat[SyntaxKind.ExclamationToken] =
    builder.CreateNot.bind(builder);

  UnaryOperators[SyntaxKind.TildeToken] = builder.CreateNot.bind(builder);
  UnaryOperatorsFloat[SyntaxKind.TildeToken] = builder.CreateNot.bind(builder);

  UnaryOperators[SyntaxKind.MinusToken] = builder.CreateNeg.bind(builder);
  UnaryOperators[SyntaxKind.MinusToken] = builder.CreateFNeg.bind(builder);

  ast.forEach((node) => {
    switch (node.kind) {
      // TODO: add more to switch and eventually make this into a function which contains every possible child and how to handle it
      case SyntaxKind.FunctionDeclaration:
        create_function(
          node as FunctionDeclaration,
          builder,
          context,
          typeChecker,
          module
        );
    }
  });
  return module;
};

// TODO add a return type and parameters
const create_function = (
  node: FunctionDeclaration,
  builder: llvm.IRBuilder,
  context: llvm.LLVMContext,
  typeChecker: ts.TypeChecker,
  module: llvm.Module
) => {
  let funcName =
    node.name?.kind == SyntaxKind.Identifier && node.name?.escapedText;
  if (!funcName) {
    return; // Add something empty of a type idk
  }
  const returnType = builder.getInt32Ty();
  const funcType = llvm.FunctionType.get(returnType, false);
  const func = llvm.Function.Create(
    funcType,
    llvm.Function.LinkageTypes.ExternalLinkage,
    funcName,
    module
  );
  const fnStart = llvm.BasicBlock.Create(context, "start", func);
  builder.SetInsertPoint(fnStart);

  const body = node.body;
  if (!body || body?.kind !== SyntaxKind.Block) {
    return;
  }

  body.forEachChild((node) => {
    switch (node.kind) {
      case SyntaxKind.ForStatement:
        const start_block = create_for(
          node as ForStatement,
          builder,
          context,
          typeChecker,
          module
        );
        const next_block = llvm.BasicBlock.Create(context, undefined, func);
        builder.CreateBr(next_block);
        builder.SetInsertPoint(fnStart);
        builder.CreateBr(start_block);
        builder.SetInsertPoint(next_block);
    }
  });
  // TODO have a proper return
  builder.CreateRet(builder.getInt32(0));
};

const var_dec_list = (
  node: VariableDeclarationList,
  builder: llvm.IRBuilder,
  context: llvm.LLVMContext,
  typeChecker: ts.TypeChecker,
  module: llvm.Module
) => {
  node.declarations.forEach((var_dec) => {
    if (var_dec.name.kind === SyntaxKind.Identifier) {
      const name = var_dec.name.escapedText;
      let value = null;
      switch (var_dec.initializer?.kind) {
        // TODO: Add more, make function work for stuff that isnt a number
        case SyntaxKind.NumericLiteral:
          value = parseInt((var_dec.initializer as ts.NumericLiteral).text);
        // ? consider how to distinguish between char and string.
      }

      // ? Do we need to check for valid variable names? How should we lint?
      if (
        typeof value !== "undefined" &&
        name &&
        typeof name !== "undefined" &&
        var_dec.initializer
      ) {
        let type = typeChecker.typeToString(
          typeChecker.getTypeAtLocation(var_dec)
        );

        if (!(type in TypeByName)) {
          type = "i64"; // TODO: should this be a float? Probably but idk exactly how to do floats rn
        }
        VARS[name] = create_primitive_var(name, TypeByName[type], builder);
        // VARS[name] = builder.CreateAlloca(TypeByName[type], null, name)
        set_var(TypeValueByName[type](value), VARS[name], builder);
      }
    }
  });
};

const create_primitive_var = (
  name: string,
  type: llvm.Type,
  builder: llvm.IRBuilder
) => {
  return builder.CreateAlloca(type, null, name);
};

const set_var = (
  value: llvm.Value,
  var_alloc: llvm.AllocaInst,
  builder: llvm.IRBuilder
) => {
  if (
    !llvm.Type.isSameType(
      value.getType(),
      var_alloc.getType().getPointerElementType()
    )
  ) {
    throw TypeError(
      `Variable types do not match. Cannot change type of a variable`
    ); // TODO: better message
  }
  builder.CreateStore(value, var_alloc);
};

const handle_binary_expression = (
  node: ts.BinaryExpression,
  builder: llvm.IRBuilder,
  context: llvm.LLVMContext,
  typeChecker: ts.TypeChecker,
  module: llvm.Module
) => {
  let right_val: llvm.Value;
  let left_val: llvm.Value;
  let right_val_type: string = "i64";

  switch (node.left.kind) {
    case SyntaxKind.Identifier:
      const name = (node.left as ts.Identifier).escapedText as string;
      right_val_type = typeChecker.typeToString(
        typeChecker.getTypeAtLocation(node.left)
      );
      const alloc_left = VARS[name];
      if (alloc_left) {
        left_val = builder.CreateLoad(
          alloc_left.getType().getPointerElementType(),
          alloc_left,
          name
        );
      } else {
        throw Error(`Variable ${name} does not exist.`); // TODO: better message
      }
      break;
    case SyntaxKind.NumericLiteral:
      let type = typeChecker.typeToString(
        typeChecker.getTypeAtLocation(node.left)
      );

      if (!(type in TypeByName)) {
        type = "i64"; // TODO: should this be a float? Probably but idk exactly how to do floats rn
      }
      right_val_type = type;
      left_val = TypeValueByName[type](
        parseInt((node.left as ts.NumericLiteral).text)
      );
      break;
    default:
      throw Error("Not implemented");
  }

  switch (node.right.kind) {
    case SyntaxKind.Identifier:
      const name = (node.right as ts.Identifier).escapedText as string;
      const alloc_right = VARS[name];
      if (alloc_right) {
        right_val = builder.CreateLoad(
          alloc_right.getType().getPointerElementType(),
          alloc_right,
          name
        );
      } else {
        throw Error(`Variable ${name} does not exist.`); // TODO: better message
      }
      break;
    case SyntaxKind.NumericLiteral:
      let type = "";

      if (!(type in TypeByName)) {
        type = right_val_type; // TODO: should this be a float? Probably but idk exactly how to do floats rn
      }
      right_val = TypeValueByName[type](
        parseInt((node.right as ts.NumericLiteral).text)
      );
      break;
    default:
      throw Error("Not implemented"); // TODO: better message
  }

  if (!llvm.Type.isSameType(right_val.getType(), left_val.getType())) {
    throw TypeError(
      `Cannot run operations on variables of two different types.`
    ); // TODO: better message
  }

  // ? What scenarios should operators work with strings, chars, bools etc?
  switch (right_val.getType().getTypeID()) {
    case llvm.Type.TypeID.FloatTyID:
    case llvm.Type.TypeID.IntegerTyID:
      break;
    default:
      throw Error(
        "Sorry, you cannot run operations on things that arent floats or integers."
      ); // TODO: better message
  }

  if (right_val.getType().getTypeID() === llvm.Type.TypeID.IntegerTyID) {
    return BinaryOperators[node.operatorToken.kind](
      /*lhs*/ left_val,
      /*rhs*/ right_val
    );
  } else if (right_val.getType().getTypeID() === llvm.Type.TypeID.FloatTyID) {
    return BinaryOperatorsFloat[node.operatorToken.kind](
      /*lhs*/ left_val,
      /*rhs*/ right_val
    );
  }
};

const prefix_unary = (
  node: ts.PrefixUnaryExpression,
  builder: llvm.IRBuilder,
  context: llvm.LLVMContext,
  typeChecker: ts.TypeChecker,
  module: llvm.Module
) => {
  let val: llvm.Value;
  let var_alloc: llvm.AllocaInst | undefined = undefined;

  switch (node.operand.kind) {
    case SyntaxKind.Identifier:
      const name = (node.operand as ts.Identifier).escapedText as string;
      const alloc = VARS[name];
      if (alloc) {
        val = builder.CreateLoad(
          alloc.getType().getPointerElementType(),
          alloc,
          name
        );
        var_alloc = alloc;
      } else {
        throw Error(`Variable ${name} does not exist.`); // TODO: better message
      }
      break;
    case SyntaxKind.NumericLiteral:
      if (
        node.operator === SyntaxKind.MinusMinusToken ||
        node.operator === SyntaxKind.PlusPlusToken
      ) {
        throw SyntaxError("Cannot increment or decrement number");
      }
      let type = typeChecker.typeToString(
        typeChecker.getTypeAtLocation(node.operand)
      );

      if (!(type in TypeByName)) {
        type = "i64"; // TODO: should this be a float? Probably but idk exactly how to do floats rn
      }
      val = TypeValueByName[type](
        parseInt((node.operand as ts.NumericLiteral).text)
      );
      break;
    default:
      throw Error("Not implemented"); // TODO: better message
  }

  let type = typeChecker.typeToString(
    typeChecker.getTypeAtLocation(node.operand)
  );
  if (!(type in TypeByName)) {
    type = "i64"; // TODO should I change to float?
  }
  switch (node.operator) {
    case SyntaxKind.PlusPlusToken:
      const inc_val = builder.CreateAdd(TypeValueByName[type](1), val);
      if (var_alloc) {
        builder.CreateStore(inc_val, var_alloc);
      }
      break;
    case SyntaxKind.MinusMinusToken:
      const dec_val = builder.CreateSub(TypeValueByName[type](1), val);
      if (var_alloc) {
        builder.CreateStore(dec_val, var_alloc);
      }
    // TODO finish more cases
  }
};

// TODO implement postfix

/**
 * Returns the first block in the for loop
 * TODO implement a similar thing in other functions
 */
export const create_for = (
  node: ForStatement,
  builder: llvm.IRBuilder,
  context: llvm.LLVMContext,
  typeChecker: ts.TypeChecker,
  module: llvm.Module
) => {
  const parent = builder.GetInsertBlock()?.getParent();
  const init = llvm.BasicBlock.Create(context, "init");
  const cond = llvm.BasicBlock.Create(context, "condition");
  const body = llvm.BasicBlock.Create(context, "body");
  const after_body = llvm.BasicBlock.Create(context, "after");
  const end = llvm.BasicBlock.Create(context, "end");
  if (!parent) {
    return init;
  }
  parent.addBasicBlock(init);
  builder.SetInsertPoint(init);

  if (node.initializer) {
    switch (node.initializer.kind) {
      case SyntaxKind.VariableDeclarationList:
        var_dec_list(
          node.initializer as unknown as ts.VariableDeclarationList,
          builder,
          context,
          typeChecker,
          module
        );
      // TODO more cases, put in function
    }
  }

  builder.CreateBr(cond);

  // TODO use actual comparison
  parent.addBasicBlock(cond);
  builder.SetInsertPoint(cond);
  let condCheck;
  if (node.condition) {
    switch (node.condition.kind) {
      // ? Is it possible for it to be something else?
      // TODO: more conditions
      case SyntaxKind.BinaryExpression:
        condCheck = handle_binary_expression(
          node.condition as BinaryExpression,
          builder,
          context,
          typeChecker,
          module
        );
    }
  }
  if (!condCheck) {
    throw Error("Condition didn't generate"); // TODO: better message
  }
  builder.CreateCondBr(condCheck, body, end);

  parent.addBasicBlock(body);
  builder.SetInsertPoint(body);
  // TODO the content here
  builder.CreateBr(after_body);

  // TODO node.incrementer
  parent.addBasicBlock(after_body);
  builder.SetInsertPoint(after_body);
  if (node.incrementor) {
    switch (node.incrementor.kind) {
      // TODO more conditions
      case SyntaxKind.PrefixUnaryExpression: // eg ++i or --i
        // TODO
        prefix_unary(
          node.incrementor as ts.PrefixUnaryExpression,
          builder,
          context,
          typeChecker,
          module
        );
      case SyntaxKind.PostfixUnaryExpression: // eg i++ or i--
      // TODO
    }
  }
  return init;
};

export default gen_llvm;
