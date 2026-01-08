declare module "onnxruntime-node" {
  export type InferenceSession = unknown;
  export const InferenceSession: {
    create: (...args: unknown[]) => Promise<unknown>;
  };
  export type Tensor<T = unknown> = {
    data: T;
    dims: number[];
  };
  export type SessionOptions = Record<string, unknown>;
}
