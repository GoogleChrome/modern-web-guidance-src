/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FEATURE_GATES } from "../core/feature-gates.ts";
import { handleSetAllowGate, type SetAllowGateOptions } from "./set-allow-gate.ts";

export type SetAllowVolatileFeaturesOptions = SetAllowGateOptions;

export function handleSetAllowVolatileFeatures(opts?: SetAllowVolatileFeaturesOptions): Promise<number> {
  return handleSetAllowGate(FEATURE_GATES["volatile-features"], opts);
}
