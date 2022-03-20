import ts from "typescript";

export const printASTKinds = (node: ts.Node) => {
  let indentationLevel = 0;
  const innerFunc = (node: ts.Node) => {
    console.log(`${" ".repeat(indentationLevel)}${ts.SyntaxKind[node.kind]}`);
    indentationLevel += 2;
    ts.forEachChild(node, innerFunc);
    indentationLevel -= 2;
  };
  innerFunc(node);
};

export const printAST = (node: ts.Node) => {
  const ast = JSON.stringify(
    node,
    (key: string, value: string) => {
      if (key === "kind") return ts.SyntaxKind[parseInt(value)];
      if (key === "parent") return "[Circular]";
      return value;
    },
    2
  );
  console.log(ast);
};
