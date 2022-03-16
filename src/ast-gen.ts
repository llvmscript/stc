import ts from "typescript";

const code = `
function momento(count: i16) {
  for (let i = 0; i < count; i++) {
    console.log("de bruh");
  }
}
`;

const ast = () => {
    // const node = ts.createSourceFile("x.ts", code, ts.ScriptTarget.Latest);
    const program = ts.createProgram(['./test/main.ts'], {});
    const n = program.getSourceFile('./test/main.ts')?.statements
    if (!n) {
        return
    }

    // const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    // const result = printer.printNode(ts.EmitHint.Unspecified, node, node);

//   console.log(result);
    return {nodes: n, typeChecker: program.getTypeChecker()}
};

export default ast;