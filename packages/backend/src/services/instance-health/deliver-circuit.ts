/**
 * @packageDocumentation
 *
 * 配送用のサーキットブレーカーの実体（このプロセスで 1 つ）。
 *
 * @remarks
 * index.ts（配送の前後）と state.ts（停止の解除でブレーカーの状態を消す）の両方から使うので、
 * 循環 import にならないよう独立したファイルに置く。
 *
 * @internal
 */
import { HostCircuitBreaker } from "./circuit.js";

/**
 * 配送用のサーキットブレーカー。
 *
 * @remarks
 * 中身は可変（ホストごとの状態を持つ）。状態は queue ワーカーのメモリにだけある。
 *
 * @internal
 */
export const deliverCircuit = new HostCircuitBreaker();
