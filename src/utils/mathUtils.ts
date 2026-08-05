import { StatMetrics } from '../types';

export const PHYSICAL_CONSTANTS = Object.freeze({
  R: 8.314462618, // J/(mol·K)
  KELVIN_OFFSET: 273.15,
  MIN_VALID_KELVIN: 273.15,
  MAX_VALID_KELVIN: 423.15,
});

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  isDegenerate: boolean;
}

/**
 * Standard Ordinary Least Squares (OLS) Linear Regression
 */
export function linearRegression(X: number[], Y: number[]): LinearRegressionResult {
  const n = X.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, r2: 0, isDegenerate: true };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += X[i];
    sumY += Y[i];
    sumXY += X[i] * Y[i];
    sumXX += X[i] * X[i];
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) {
    return { slope: 0, intercept: 0, r2: 0, isDegenerate: true };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R2
  const meanY = sumY / n;
  let sst = 0;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const yPred = slope * X[i] + intercept;
    sse += Math.pow(Y[i] - yPred, 2);
    sst += Math.pow(Y[i] - meanY, 2);
  }

  const r2 = sst === 0 ? 0 : Math.max(0, 1 - sse / sst);

  return { slope, intercept, r2, isDegenerate: false };
}

/**
 * Calculates complete statistical metrics for model evaluation
 */
export function calculateStatMetrics(
  yExp: number[],
  yPred: number[],
  pCount: number
): StatMetrics {
  const n = yExp.length;
  let sse = 0;
  let sumAbsErr = 0;
  let chiSq = 0;
  let sumY = 0;

  for (let i = 0; i < n; i++) {
    const err = yExp[i] - yPred[i];
    sse += err * err;
    sumAbsErr += Math.abs(err);

    const safePred = Math.abs(yPred[i]) > 1e-9 ? Math.abs(yPred[i]) : 1e-9;
    chiSq += (err * err) / safePred;
    sumY += yExp[i];
  }

  const meanY = sumY / n;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sst += Math.pow(yExp[i] - meanY, 2);
  }

  const mse = sse / n;
  const mae = sumAbsErr / n;
  const rmse = Math.sqrt(mse);
  const r2 = sst === 0 ? 0 : Math.max(-1, 1 - sse / sst);

  const denomAdj = n - pCount - 1;
  const adjR2 = denomAdj > 0 ? 1 - ((1 - r2) * (n - 1)) / denomAdj : r2;

  const sseForIC = sse <= 0 ? 1e-12 : sse;
  const aic = n * Math.log(sseForIC / n) + 2 * pCount;
  const bic = n * Math.log(sseForIC / n) + pCount * Math.log(n);
  const aicc = denomAdj > 0 ? aic + (2 * pCount * (pCount + 1)) / denomAdj : aic;

  return {
    r2,
    adjR2,
    rmse,
    mse,
    sse,
    mae,
    chiSquare: chiSq,
    aic,
    aicc,
    bic,
  };
}

/**
 * Boyd's F value to Bt conversion function
 * Boyd equation for spherical particles:
 * F = qt / qe
 * For F > 0.85: Bt = -0.4977 - ln(1 - F)
 * For F <= 0.85: Bt = pi * (1 - sqrt(1 - (pi * F / 3)))^2
 */
export function calculateBoydBt(F: number): number {
  const safeF = Math.min(Math.max(F, 0.0001), 0.9999);
  if (safeF > 0.85) {
    return -0.4977 - Math.log(1 - safeF);
  } else {
    const term = Math.sqrt(Math.max(0, 1 - (Math.PI * safeF) / 3));
    return Math.PI * Math.pow(1 - term, 2);
  }
}

/**
 * Generic SSE calculation for fitting functions
 */
export function evaluateSSE(
  X: number[],
  Y: number[],
  predFn: (x: number, p: number[]) => number,
  params: number[]
): number {
  let sse = 0;
  for (let i = 0; i < X.length; i++) {
    const pred = predFn(X[i], params);
    if (!isFinite(pred)) return Infinity;
    const err = Y[i] - pred;
    sse += err * err;
  }
  return sse;
}

/**
 * Pattern-search coordinate descent optimizer for non-linear fitting
 */
export function patternSearchOptimize(
  X: number[],
  Y: number[],
  predFn: (x: number, p: number[]) => number,
  p0: number[],
  bounds: [number, number][],
  maxIter = 600
): { params: number[]; sse: number } {
  let p = [...p0];
  let steps = p.map((v) => (Math.abs(v) > 1e-9 ? Math.abs(v) * 0.15 : 0.05));

  let bestSSE = evaluateSSE(X, Y, predFn, p);
  if (!isFinite(bestSSE)) {
    p = p.map((v, i) => {
      const [lo, hi] = bounds[i];
      if (!isFinite(v) || v <= lo || v >= hi) return (lo + hi) / 2 || 1.0;
      return v;
    });
    bestSSE = evaluateSSE(X, Y, predFn, p);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    let improved = false;
    for (let dim = 0; dim < p.length; dim++) {
      for (const sign of [1, -1]) {
        const testP = [...p];
        testP[dim] += sign * steps[dim];
        const [lo, hi] = bounds[dim];
        if (testP[dim] <= lo || testP[dim] >= hi) continue;
        const testSse = evaluateSSE(X, Y, predFn, testP);
        if (testSse < bestSSE) {
          bestSSE = testSse;
          p = testP;
          improved = true;
        }
      }
    }
    if (!improved) {
      steps = steps.map((s) => s * 0.5);
    }
    if (steps.every((s) => s < 1e-8)) break;
  }

  return { params: p, sse: bestSSE };
}
