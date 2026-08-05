import {
  IsothermAnalysisResults,
  IsothermModelResult,
} from '../types';
import {
  calculateStatMetrics,
  linearRegression,
  PHYSICAL_CONSTANTS,
  patternSearchOptimize,
} from './mathUtils';

// Redlich-Peterson helper
function predRP(c: number, p: number[]): number {
  const [krp, arp, g] = p;
  return (krp * c) / (1 + arp * Math.pow(c <= 0 ? 1e-9 : c, g));
}

// Sips helper
function predSips(c: number, p: number[]): number {
  const [qm, ks, n] = p;
  const term = Math.pow(ks * (c <= 0 ? 1e-9 : c), 1 / n);
  return (qm * term) / (1 + term);
}

// Toth helper
function predToth(c: number, p: number[]): number {
  const [qm, kt, t] = p;
  const cc = c <= 0 ? 1e-9 : c;
  return (qm * cc) / Math.pow(kt + Math.pow(cc, t), 1 / t);
}

// BET helper
function predBET(c: number, p: number[]): number {
  const [qm, cbet, cs] = p;
  if (c >= cs) return NaN;
  const denom = (cs - c) * (1 + (cbet - 1) * (c / cs));
  if (denom <= 0) return NaN;
  return (qm * cbet * c) / denom;
}

// Hill helper
function predHill(c: number, p: number[]): number {
  const [qmax, kd, nh] = p;
  const cn = Math.pow(c <= 0 ? 1e-9 : c, nh);
  return (qmax * cn) / (kd + cn);
}

// Khan helper
function predKhan(c: number, p: number[]): number {
  const [qm, bk, ak] = p;
  return (qm * bk * c) / Math.pow(1 + bk * c, ak);
}

// Radke-Prausnitz helper
function predRadke(c: number, p: number[]): number {
  const [krp, arp, m] = p;
  const cc = c <= 0 ? 1e-9 : c;
  return (krp * arp * cc) / (arp + krp * Math.pow(cc, 1 - m));
}

function multiStartFit(
  Ce: number[],
  Qe: number[],
  predFn: (c: number, p: number[]) => number,
  p0List: number[][],
  bounds: [number, number][]
) {
  let best: { params: number[]; sse: number } | null = null;
  for (const p0 of p0List) {
    const res = patternSearchOptimize(Ce, Qe, predFn, p0, bounds);
    if (!best || res.sse < best.sse) best = res;
  }
  return best!;
}

export function runIsothermAnalysis(
  rawCe: number[],
  rawQe: number[],
  rawC0: number[],
  T_kelvin: number,
  fitMode: 'linear' | 'nonlinear'
): IsothermAnalysisResults {
  const combined = rawCe.map((e, i) => ({ ce: e, qe: rawQe[i], c0: rawC0[i] }));
  combined.sort((a, b) => a.ce - b.ce);

  const Ce = combined.map((d) => d.ce);
  const Qe = combined.map((d) => d.qe);
  const C0 = combined.map((d) => d.c0);
  const N = Ce.length;

  // 1. Langmuir
  const X_lang = Ce;
  const Y_lang = Ce.map((c, i) => c / Qe[i]);
  const regLang = linearRegression(X_lang, Y_lang);
  let qm = 1 / (regLang.slope || 1);
  let kl = (regLang.slope || 1) / (regLang.intercept || 1);

  // 2. Freundlich
  const X_freund = Ce.map((c) => Math.log(c <= 0 ? 1e-5 : c));
  const Y_freund = Qe.map((q) => Math.log(q <= 0 ? 1e-5 : q));
  const regFreund = linearRegression(X_freund, Y_freund);
  let inv_n = regFreund.slope;
  let n = 1 / (inv_n || 1);
  let kf = Math.exp(regFreund.intercept);

  // 3. Temkin
  const X_temkin = Ce.map((c) => Math.log(c <= 0 ? 1e-5 : c));
  const Y_temkin = Qe;
  const regTemkin = linearRegression(X_temkin, Y_temkin);
  let B_temp = regTemkin.slope;
  let AT = Math.exp(regTemkin.intercept / (B_temp || 1));
  let b_temkin = (PHYSICAL_CONSTANTS.R * T_kelvin) / (B_temp || 1);

  // 4. Dubinin-Radushkevich
  const R_gas = PHYSICAL_CONSTANTS.R;
  const Epsilon2 = Ce.map((c) => {
    const ep = R_gas * T_kelvin * Math.log(1 + 1 / (c <= 0 ? 1e-5 : c));
    return ep * ep;
  });
  const Y_dr = Qe.map((q) => Math.log(q <= 0 ? 1e-5 : q));
  const regDR = linearRegression(Epsilon2, Y_dr);
  let qD = Math.exp(regDR.intercept);
  let beta_dr = -regDR.slope;
  let E_energy = beta_dr > 0 ? 1 / Math.sqrt(2 * beta_dr) / 1000 : 0;

  if (fitMode === 'nonlinear') {
    // Non-linear refinement for 2-param models
    const resLang = patternSearchOptimize(
      Ce,
      Qe,
      (c, [q, k]) => (q * k * c) / (1 + k * c),
      [qm > 0 ? qm : 1, kl > 0 ? kl : 1],
      [[1e-4, 1e6], [1e-6, 1e6]]
    );
    qm = resLang.params[0];
    kl = resLang.params[1];

    const resFreund = patternSearchOptimize(
      Ce,
      Qe,
      (c, [k, nn]) => k * Math.pow(c <= 0 ? 0 : c, 1 / nn),
      [kf > 0 ? kf : 1, n > 0 ? n : 1],
      [[1e-6, 1e6], [0.01, 50]]
    );
    kf = resFreund.params[0];
    n = resFreund.params[1];
    inv_n = 1 / n;

    const resTemkin = patternSearchOptimize(
      Ce,
      Qe,
      (c, [a, b]) => b * Math.log(a * (c <= 0 ? 1e-5 : c)),
      [AT > 0 ? AT : 1, B_temp > 0 ? B_temp : 1],
      [[1e-6, 1e6], [1e-4, 1e6]]
    );
    AT = resTemkin.params[0];
    B_temp = resTemkin.params[1];
    b_temkin = (PHYSICAL_CONSTANTS.R * T_kelvin) / B_temp;

    const resDR = patternSearchOptimize(
      Ce,
      Qe,
      (c, [q, b]) => {
        const ep = PHYSICAL_CONSTANTS.R * T_kelvin * Math.log(1 + 1 / (c <= 0 ? 1e-5 : c));
        return q * Math.exp(-b * ep * ep);
      },
      [qD > 0 ? qD : 1, beta_dr > 0 ? beta_dr : 1e-8],
      [[1e-4, 1e6], [1e-15, 1e-1]]
    );
    qD = resDR.params[0];
    beta_dr = resDR.params[1];
    E_energy = beta_dr > 0 ? 1 / Math.sqrt(2 * beta_dr) / 1000 : 0;
  }

  // 3-parameter models (always non-linear optimized)
  const krpInit = qm > 0 && kl > 0 ? qm * kl : Qe[0] / Ce[0];
  const arpInit = kl > 0 ? kl : 1.0;
  const rpRes = multiStartFit(
    Ce,
    Qe,
    predRP,
    [0.1, 0.5, 0.9].map((g) => [krpInit > 0 ? krpInit : 1, arpInit > 0 ? arpInit : 1, g]),
    [[1e-6, 1e9], [1e-9, 1e9], [1e-4, 1.5]]
  );

  const sipsRes = multiStartFit(
    Ce,
    Qe,
    predSips,
    [0.5, 1.0, 2.0].map((nn) => [qm > 0 ? qm : 1, kl > 0 ? kl : 1, nn]),
    [[1e-6, 1e6], [1e-9, 1e9], [0.05, 20]]
  );

  const ktInit = kl > 0 ? 1 / kl : 1.0;
  const tothRes = multiStartFit(
    Ce,
    Qe,
    predToth,
    [0.5, 1.0, 2.0].map((t) => [qm > 0 ? qm : 1, ktInit > 0 ? ktInit : 1, t]),
    [[1e-6, 1e6], [1e-9, 1e9], [0.05, 10]]
  );

  const maxCe = Math.max(...Ce);
  const betRes = multiStartFit(
    Ce,
    Qe,
    predBET,
    [[qm > 0 ? qm : 1, 10, maxCe * 1.5], [qm > 0 ? qm : 1, 50, maxCe * 2]],
    [[1e-6, 1e6], [1e-3, 1e6], [maxCe * 1.001, maxCe * 200]]
  );

  const kdInit = kl > 0 ? 1 / kl : 1.0;
  const hillRes = multiStartFit(
    Ce,
    Qe,
    predHill,
    [0.5, 1.0, 2.0].map((nh) => [qm > 0 ? qm : 1, kdInit > 0 ? kdInit : 1, nh]),
    [[1e-6, 1e6], [1e-9, 1e9], [0.05, 10]]
  );

  const khanRes = multiStartFit(
    Ce,
    Qe,
    predKhan,
    [0.5, 1.0, 2.0].map((ak) => [qm > 0 ? qm : 1, kl > 0 ? kl : 1, ak]),
    [[1e-6, 1e6], [1e-9, 1e9], [0.05, 10]]
  );

  const radkeRes = multiStartFit(
    Ce,
    Qe,
    predRadke,
    [0.1, 0.5, 0.9].map((m) => [krpInit > 0 ? krpInit : 1, qm > 0 ? qm : 1, m]),
    [[1e-6, 1e9], [1e-9, 1e9], [0.001, 0.999]]
  );

  const buildModelResult = (
    name: string,
    nameEn: string,
    pCount: number,
    pred: number[],
    params: Record<string, number>,
    description: string
  ): IsothermModelResult => {
    const stat = calculateStatMetrics(Qe, pred, pCount);
    const residuals = Qe.map((q, i) => q - pred[i]);
    return {
      name,
      nameEn,
      pCount,
      pred,
      residuals,
      params,
      description,
      ...stat,
    };
  };

  const langmuir = buildModelResult(
    'لانغماير (Langmuir)',
    'Langmuir',
    2,
    Ce.map((c) => (qm * kl * c) / (1 + kl * c)),
    { qm, kl },
    'امتزاز أحادي الطبقة متجانس'
  );

  const freundlich = buildModelResult(
    'فروندلش (Freundlich)',
    'Freundlich',
    2,
    Ce.map((c) => kf * Math.pow(c <= 0 ? 0 : c, inv_n)),
    { kf, n, inv_n },
    'امتزاز غير متجانس متعدد الطبقات'
  );

  const temkin = buildModelResult(
    'تمكين (Temkin)',
    'Temkin',
    2,
    Ce.map((c) => B_temp * Math.log(AT * (c <= 0 ? 1e-5 : c))),
    { at: AT, b: b_temkin, b_temp: B_temp },
    'تفاعلات المادة الممتزة وانخفاض حرارة الامتزاز خطياً'
  );

  const dr = buildModelResult(
    'دوبينين (Dubinin-Radushkevich)',
    'Dubinin-Radushkevich',
    2,
    Ce.map((c, i) => qD * Math.exp(-beta_dr * Epsilon2[i])),
    { qd: qD, beta: beta_dr, e: E_energy },
    'تمييز نمط الامتزاز (فيزيائي أم كيميائي)'
  );

  const rp = buildModelResult(
    'ريدلخ-بيترسون (Redlich-Peterson)',
    'Redlich-Peterson',
    3,
    Ce.map((c) => predRP(c, rpRes.params)),
    { krp: rpRes.params[0], arp: rpRes.params[1], g: rpRes.params[2] },
    'موديل هجين ثلاثي المعالم'
  );

  const sips = buildModelResult(
    'سيبس (Sips)',
    'Sips',
    3,
    Ce.map((c) => predSips(c, sipsRes.params)),
    { qm: sipsRes.params[0], ks: sipsRes.params[1], n: sipsRes.params[2] },
    'دمج موديلي لانغماير وفروندلش'
  );

  const toth = buildModelResult(
    'توث (Toth)',
    'Toth',
    3,
    Ce.map((c) => predToth(c, tothRes.params)),
    { qm: tothRes.params[0], kt: tothRes.params[1], t: tothRes.params[2] },
    'موديل تجريبي للأسطح غير المتجانسة'
  );

  const bet = buildModelResult(
    'BET',
    'BET',
    3,
    Ce.map((c) => predBET(c, betRes.params)),
    { qm: betRes.params[0], cbet: betRes.params[1], cs: betRes.params[2] },
    'امتزاز متعدد الطبقات'
  );

  const hill = buildModelResult(
    'هيل (Hill)',
    'Hill',
    3,
    Ce.map((c) => predHill(c, hillRes.params)),
    { qmax: hillRes.params[0], kd: hillRes.params[1], nh: hillRes.params[2] },
    'امتزاز تعاوني على أسطح متجانسة'
  );

  const khan = buildModelResult(
    'خان (Khan)',
    'Khan',
    3,
    Ce.map((c) => predKhan(c, khanRes.params)),
    { qm: khanRes.params[0], bk: khanRes.params[1], ak: khanRes.params[2] },
    'موديل عام ثلاثي المعالم'
  );

  const radke = buildModelResult(
    'رادكه-براوسنيتز (Radke-Prausnitz)',
    'Radke-Prausnitz',
    3,
    Ce.map((c) => predRadke(c, radkeRes.params)),
    { krp: radkeRes.params[0], arp: radkeRes.params[1], m: radkeRes.params[2] },
    'سلوك انتقالي بين قانون هنري وفروندلش'
  );

  const modelsList = [langmuir, freundlich, temkin, dr, rp, sips, toth, bet, hill, khan, radke];
  const rankedModels = [...modelsList].sort((a, b) => a.aic - b.aic);
  rankedModels.forEach((m, idx) => {
    m.rank = idx + 1;
  });

  return {
    Ce,
    Qe,
    C0,
    models: {
      langmuir,
      freundlich,
      temkin,
      dr,
      rp,
      sips,
      toth,
      bet,
      hill,
      khan,
      radke,
    },
    rankedModels,
  };
}
