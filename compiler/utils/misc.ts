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

export const getEnumKeyByEnumValue = <
  TEnumKey extends string,
  TEnumVal extends string | number
>(
  myEnum: { [key in TEnumKey]: TEnumVal },
  enumValue: TEnumVal
): string => {
  const keys = (Object.keys(myEnum) as TEnumKey[]).filter(
    (x) => myEnum[x] === enumValue
  );
  return keys.length > 0 ? keys[0] : "";
};
