export type Serialized = string;

export const encode = (value: unknown): Serialized => JSON.stringify(value);

export const decode = <T>(raw: Serialized): T => JSON.parse(raw) as T;
