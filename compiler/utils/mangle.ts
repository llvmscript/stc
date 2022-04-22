export const manglePropertyAccess = (expr: string) => {
  return expr.replace(".", "__");
};
