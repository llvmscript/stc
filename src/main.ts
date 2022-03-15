import ts from "typescript";

const code = `
function momento(count: i16) {
  for (let i = 0; i < count; i++) {
    console.log("de bruh");
  }
}
`;

const main = async () => {
  const node = ts.createSourceFile("x.ts", code, ts.ScriptTarget.Latest);
  console.log(JSON.stringify(node.statements, undefined, 2));

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const result = printer.printNode(ts.EmitHint.Unspecified, node, node);

  console.log(result);
};

main();
