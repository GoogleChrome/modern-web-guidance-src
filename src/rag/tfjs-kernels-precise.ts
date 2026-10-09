import { registerKernel } from "@tensorflow/tfjs-core";
import { MathBackendCPU } from "@tensorflow/tfjs-backend-cpu/dist/base.js";
import { castConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Cast.js";
import { gatherV2Config } from "@tensorflow/tfjs-backend-cpu/dist/kernels/GatherV2.js";
import { expandDimsConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/ExpandDims.js";
import { stridedSliceConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/StridedSlice.js";
import { reshapeConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Reshape.js";
import { packConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Pack.js";
import { subConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Sub.js";
import { multiplyConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Multiply.js";
import { addConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Add.js";
import { rangeConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Range.js";
import { meanConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Mean.js";
import { squaredDifferenceConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/SquaredDifference.js";
import { rsqrtConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Rsqrt.js";
import { prodConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Prod.js";
import { concatConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Concat.js";
import { batchMatMulConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/BatchMatMul.js";
import { transposeConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Transpose.js";
import { softmaxConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Softmax.js";
import { erfConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Erf.js";
import { tileConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Tile.js";
import { sumConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Sum.js";
import { minimumConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Minimum.js";
import { maximumConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Maximum.js";
import { realDivConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/RealDiv.js";
import { squareConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Square.js";
import { identityConfig } from "@tensorflow/tfjs-backend-cpu/dist/kernels/Identity.js";

// Force MathBackendCPU to be included in the bundle
const _unused = MathBackendCPU;

[castConfig, gatherV2Config, expandDimsConfig, stridedSliceConfig, reshapeConfig, packConfig, subConfig, multiplyConfig, addConfig, rangeConfig, meanConfig, squaredDifferenceConfig, rsqrtConfig, prodConfig, concatConfig, batchMatMulConfig, transposeConfig, softmaxConfig, erfConfig, tileConfig, sumConfig, minimumConfig, maximumConfig, realDivConfig, squareConfig, identityConfig].forEach(c => registerKernel(c));
