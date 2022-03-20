export const modifyObject = <T>(
  obj: T,
  replacer: <V>(key: string, value: V) => V
) => {
  if (typeof obj === "object") {
    for (const key in obj) {
      obj[key] = replacer(key, obj[key]);
      if (typeof obj[key] === "object") {
        modifyObject(obj, replacer);
      }
    }
  }
  return obj;
};
