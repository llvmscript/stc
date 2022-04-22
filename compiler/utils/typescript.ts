import ts from "typescript";

export const printASTKinds = (node: ts.Node) => {
  const lines: { indt: number; kind: string; text: string }[] = [];

  // const _innerFunc = (node: ts.Node) => {
  //   const ident = " ".repeat(indentationLevel);
  //   const skind = ts.SyntaxKind[node.kind];
  //   const ntext = node.getText().replace("\n", "⏎");
  //   let newIdentLevel = 0;
  //   newIdentLevel = printedKindLength - (ident.length + skind.length);
  //   if (newIdentLevel < 0) {
  //     newIdentLevel = 1;
  //   }
  //   console.log(`${ident}${skind}${" ".repeat(newIdentLevel)}${ntext}`);
  //   printedKindLength = ident.length + skind.length;
  //   indentationLevel += 2;
  //   ts.forEachChild(node, innerFunc);
  //   indentationLevel -= 2;
  // };

  let indentationLevel = 0;

  const innerFunc = (node: ts.Node) => {
    lines.push({
      indt: indentationLevel,
      kind: ts.SyntaxKind[node.kind],
      text: node.getText().replace(/\n/g, "⏎"),
    });
    indentationLevel += 2;
    ts.forEachChild(node, innerFunc);
    indentationLevel -= 2;
  };
  innerFunc(node);

  for (const line of lines) {
    // calculate spacing needed for nodeText
    const longestLine = Math.max(
      ...lines.map((line) => line.indt + line.kind.length)
    );
    const nodeTextSpacing = longestLine - (line.indt + line.kind.length) + 2;

    process.stdout.write(" ".repeat(line.indt));
    process.stdout.write(line.kind);
    process.stdout.write(" ".repeat(nodeTextSpacing));
    process.stdout.write(`:: ${line.text}`);
    process.stdout.write("\n");
  }
};

export const printAST = (node: ts.Node) => {
  const ast = JSON.stringify(
    node,
    (key: string, value: string) => {
      if (key === "kind") return ts.SyntaxKind[parseInt(value)];
      if (key === "parent") return "[Circular]";
      if (key === "symbol") return "[Circular]";
      return value;
    },
    2
  );
  console.log(ast);
};
