export interface IsothermPoint {
  c0: number;
  ce: number;
  qe?: number;
}

export interface KineticsPoint {
  t: number;
  ct: number;
  qt?: number;
}

export interface StatMetrics {
  r2: number;
  adjR2: number;
  rmse: number;
  mse: number;
  sse: number;
  mae: number;
  chiSquare: number;
  aic: number;
  aicc: number;
  bic: number;
  rank?: number;
}

// Isotherm Models
export interface IsothermModelResult extends StatMetrics {
  name: string;
  nameEn: string;
  pCount: number;
  pred: number[];
  residuals: number[];
  params: Record<string, number>;
  description: string;
}

// Kinetics Models
export interface KineticsModelResult extends StatMetrics {
  id: string;
  name: string;
  nameEn: string;
  pCount: number;
  pred: number[];
  residuals: number[];
  params: Record<string, number>;
  formulaText: string;
  linearFormulaText: string;
  interpretation: string;
  linearData?: { x: number; y: number; labelX: string; labelY: string }[];
}

export interface IsothermAnalysisResults {
  Ce: number[];
  Qe: number[];
  C0: number[];
  models: {
    langmuir: IsothermModelResult;
    freundlich: IsothermModelResult;
    temkin: IsothermModelResult;
    dr: IsothermModelResult;
    rp: IsothermModelResult;
    sips: IsothermModelResult;
    toth: IsothermModelResult;
    bet: IsothermModelResult;
    hill: IsothermModelResult;
    khan: IsothermModelResult;
    radke: IsothermModelResult;
  };
  rankedModels: IsothermModelResult[];
}

export interface KineticsAnalysisResults {
  t: number[];
  Ct: number[];
  qt: number[];
  C0kin: number;
  W: number;
  V: number;
  qeExp: number;
  models: {
    pfo: KineticsModelResult;
    pso: KineticsModelResult;
    elovich: KineticsModelResult;
    weberMorris: KineticsModelResult;
    boyd: KineticsModelResult;
    filmDiffusion: KineticsModelResult;
  };
  rankedModels: KineticsModelResult[];
  overallInterpretation: string;
  weberMorrisStages?: { stage: number; slope: number; intercept: number; r2: number; tRange: string }[];
}

export interface ProjectState {
  weightW: number;
  volumeV: number;
  temperatureT: number;
  tempUnit: 'C' | 'K';
  fittingMode: 'linear' | 'nonlinear';
  points: { c0: string; ce: string }[];
  kinC0: number;
  kinPoints: { t: string; ct: string }[];
  timestamp?: string;
}
