import * as d3 from "d3";

// -- A helper to compute a kernel density estimate. Adjust bandwidth to taste.
export function kernelDensityEstimator(kernel: (u: number) => number, X: number[]) {
  return function (sample: number[]) {
    return X.map((x) => {
      return [x, d3.mean(sample, (v) => kernel(x - v)) ?? 0];
    });
  };
}

export function kernelEpanechnikov(bw: number) {
  // Epanechnikov kernel
  return function (u: number) {
    u /= bw;
    return Math.abs(u) <= 1 ? 0.75 * (1 - u * u) / bw : 0;
  };
}