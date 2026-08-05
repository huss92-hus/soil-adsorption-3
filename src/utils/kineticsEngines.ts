import {
  KineticsAnalysisResults,
  KineticsModelResult,
} from '../types';
import {
  calculateBoydBt,
  calculateStatMetrics,
  linearRegression,
  patternSearchOptimize,
} from './mathUtils';

// Helper predictions
function predPFO(t: number, qe: number, k1: number): number {
  return qe * (1 - Math.exp(-k1 * t));
}

function predPSO(t: number, qe: number, k2: number): number {
  return (k2 * qe * qe * t) / (1 + k2 * qe * t);
}

function predElovich(t: number, alpha: number, beta: number): number {
  if (t <= 0) return 0;
  // qt = (1/beta) * ln(1 + alpha * beta * t)
  const arg = 1 + alpha * beta * t;
  return arg > 0 ? (1 / beta) * Math.log(arg) : 0;
}

function predWeberMorris(t: number, kid: number, c: number): number {
  return kid * Math.sqrt(Math.max(0, t)) + c;
}

function predFilmDiffusion(t: number, qe: number, kfd: number, intercept: number): number {
  const arg = kfd * t + intercept;
  return qe * (1 - Math.exp(-Math.max(0, arg)));
}

export function runKineticsAnalysis(
  t: number[],
  Ct: number[],
  qt: number[],
  c0kin: number,
  w: number,
  v: number,
  fitMode: 'linear' | 'nonlinear'
): KineticsAnalysisResults {
  const N = t.length;
  const qeExp = Math.max(...qt);

  // -------------------------------------------------------------
  // 1. Pseudo-First Order (PFO)
  // -------------------------------------------------------------
  const qeForPFO = qeExp * 1.00001 + 1e-8;
  const Y_pfo = qt.map((q) => Math.log(Math.max(1e-8, qeForPFO - q)));
  const regPFO = linearRegression(t, Y_pfo);
  let qe_pfo = Math.exp(regPFO.intercept);
  let k1_pfo = -regPFO.slope;
  if (k1_pfo <= 0) k1_pfo = 0.01;

  if (fitMode === 'nonlinear') {
    const resPFO = patternSearchOptimize(
      t,
      qt,
      (tv, [q, k]) => predPFO(tv, q, k),
      [qeExp * 1.05, 0.02],
      [[1e-3, 1e6], [1e-6, 50]]
    );
    qe_pfo = resPFO.params[0];
    k1_pfo = resPFO.params[1];
  }

  const pred_pfo = t.map((tv) => predPFO(tv, qe_pfo, k1_pfo));
  const stat_pfo = calculateStatMetrics(qt, pred_pfo, 2);
  const pfoResult: KineticsModelResult = {
    id: 'pfo',
    name: 'الرتبة الأولى الكاذبة (PFO)',
    nameEn: 'Pseudo-First-Order',
    pCount: 2,
    pred: pred_pfo,
    residuals: qt.map((q, i) => q - pred_pfo[i]),
    params: { qe: qe_pfo, k1: k1_pfo },
    formulaText: 'q_t = q_e (1 - e^{-k_1 t})',
    linearFormulaText: '\\ln(q_e - q_t) = \\ln(q_e) - k_1 t',
    interpretation:
      stat_pfo.r2 >= 0.95
        ? `نموذج PFO يقدم مطابقة ممتازة (R² = ${stat_pfo.r2.toFixed(4)})، مما يشير إلى أن سرعة الامتزاز تتناسب طردياً مع عدد المواقع الشاغرة (امتزاز فيزيائي أو مرحلة سريعة أولية).`
        : `نموذج PFO يظهر مطابقة متوسطة (R² = ${stat_pfo.r2.toFixed(4)})، والتباين يشير إلى أن الخطوة المحددة للسرعة قد تكون تفاعلاً كيميائياً أو انتشاراً داخلياً.`,
    linearData: t.map((tv, i) => ({
      x: tv,
      y: Math.log(Math.max(1e-8, qeForPFO - qt[i])),
      labelX: 'Time t (min)',
      labelY: 'ln(qe - qt)',
    })),
    ...stat_pfo,
  };

  // -------------------------------------------------------------
  // 2. Pseudo-Second Order (PSO)
  // -------------------------------------------------------------
  const Y_pso = t.map((tv, i) => tv / Math.max(1e-8, qt[i]));
  const regPSO = linearRegression(t, Y_pso);
  let qe_pso = regPSO.slope > 0 ? 1 / regPSO.slope : qeExp * 1.05;
  let k2_pso =
    regPSO.slope > 0 && regPSO.intercept > 0
      ? (regPSO.slope * regPSO.slope) / regPSO.intercept
      : 0.001;

  if (fitMode === 'nonlinear') {
    const resPSO = patternSearchOptimize(
      t,
      qt,
      (tv, [q, k]) => predPSO(tv, q, k),
      [qe_pso > 0 ? qe_pso : qeExp, k2_pso > 0 ? k2_pso : 0.005],
      [[1e-3, 1e6], [1e-8, 50]]
    );
    qe_pso = resPSO.params[0];
    k2_pso = resPSO.params[1];
  }

  const h_pso = k2_pso * qe_pso * qe_pso;
  const pred_pso = t.map((tv) => predPSO(tv, qe_pso, k2_pso));
  const stat_pso = calculateStatMetrics(qt, pred_pso, 2);
  const psoResult: KineticsModelResult = {
    id: 'pso',
    name: 'الرتبة الثانية الكاذبة (PSO)',
    nameEn: 'Pseudo-Second-Order',
    pCount: 2,
    pred: pred_pso,
    residuals: qt.map((q, i) => q - pred_pso[i]),
    params: { qe: qe_pso, k2: k2_pso, h: h_pso },
    formulaText: 'q_t = \\frac{k_2 q_e^2 t}{1 + k_2 q_e t}',
    linearFormulaText: '\\frac{t}{q_t} = \\frac{1}{k_2 q_e^2} + \\frac{1}{q_e} t',
    interpretation:
      stat_pso.r2 >= 0.95
        ? `نموذج PSO هو الأفضل مطابقة (R² = ${stat_pso.r2.toFixed(4)})، مما يدل على أن الامتزاز الكيميائي (Chemisorption) عبر تبادل أو مشاركة الإلكترونات هو الخطوة المحددة لسرعة الامتزاز.`
        : `نموذج PSO يعطي معامل تحديد R² = ${stat_pso.r2.toFixed(4)} معدل السرعة الابتدائي h = ${h_pso.toFixed(4)} mg/(g·min).`,
    linearData: t.map((tv, i) => ({
      x: tv,
      y: tv / Math.max(1e-8, qt[i]),
      labelX: 'Time t (min)',
      labelY: 't / qt (g·min/mg)',
    })),
    ...stat_pso,
  };

  // -------------------------------------------------------------
  // 3. Elovich Model
  // -------------------------------------------------------------
  // Linear form: qt = (1/beta) * ln(alpha * beta) + (1/beta) * ln(t)
  const validPointsElovich = t
    .map((tv, i) => ({ t: tv, qt: qt[i] }))
    .filter((pt) => pt.t > 0);
  const X_elovich = validPointsElovich.map((pt) => Math.log(pt.t));
  const Y_elovich = validPointsElovich.map((pt) => pt.qt);
  const regElovich = linearRegression(X_elovich, Y_elovich);

  let beta_elovich = regElovich.slope > 0 ? 1 / regElovich.slope : 0.5;
  let alpha_elovich =
    regElovich.slope > 0
      ? (1 / beta_elovich) * Math.exp(beta_elovich * regElovich.intercept)
      : 1.0;

  if (fitMode === 'nonlinear') {
    const resElovich = patternSearchOptimize(
      t,
      qt,
      (tv, [a, b]) => predElovich(tv, a, b),
      [alpha_elovich > 0 ? alpha_elovich : 1.0, beta_elovich > 0 ? beta_elovich : 0.5],
      [[1e-6, 1e6], [1e-6, 1e4]]
    );
    alpha_elovich = resElovich.params[0];
    beta_elovich = resElovich.params[1];
  }

  const pred_elovich = t.map((tv) => predElovich(tv, alpha_elovich, beta_elovich));
  const stat_elovich = calculateStatMetrics(qt, pred_elovich, 2);
  const elovichResult: KineticsModelResult = {
    id: 'elovich',
    name: 'إلوفيتش (Elovich Model)',
    nameEn: 'Elovich',
    pCount: 2,
    pred: pred_elovich,
    residuals: qt.map((q, i) => q - pred_elovich[i]),
    params: { alpha: alpha_elovich, beta: beta_elovich },
    formulaText: 'q_t = \\frac{1}{\\beta} \\ln(1 + \\alpha \\beta t)',
    linearFormulaText: 'q_t = \\frac{1}{\\beta} \\ln(\\alpha \\beta) + \\frac{1}{\\beta} \\ln(t)',
    interpretation:
      stat_elovich.r2 >= 0.95
        ? `معامل التحديد العالي لنموذج إلوفيتش (R² = ${stat_elovich.r2.toFixed(4)}) يثبت أن السطح الماص غير متجانس طاقياً (Heterogeneous Surface) وأن طاقة التنشيط تزداد بزيادة التغطية.`
        : `نموذج إلوفيتش يعطي R² = ${stat_elovich.r2.toFixed(4)}، بمعدل امتزاز ابتدائي α = ${alpha_elovich.toFixed(4)} mg/(g·min) وثابت نتروجين/امتزاز β = ${beta_elovich.toFixed(4)} g/mg.`,
    linearData: validPointsElovich.map((pt) => ({
      x: Math.log(pt.t),
      y: pt.qt,
      labelX: 'ln(t)',
      labelY: 'qt (mg/g)',
    })),
    ...stat_elovich,
  };

  // -------------------------------------------------------------
  // 4. Intraparticle Diffusion (Weber–Morris)
  // -------------------------------------------------------------
  // qt = Kid * t^0.5 + C
  const X_wm = t.map((tv) => Math.sqrt(tv));
  const Y_wm = qt;
  const regWM = linearRegression(X_wm, Y_wm);
  const kid_wm = regWM.slope;
  const c_wm = regWM.intercept;

  const pred_wm = t.map((tv) => predWeberMorris(tv, kid_wm, c_wm));
  const stat_wm = calculateStatMetrics(qt, pred_wm, 2);

  // Scientific interpretation logic for Weber-Morris
  let wmInterp = `ثابت الانتشار الداخلي Kid = ${kid_wm.toFixed(4)} mg/(g·min^0.5) وسُمك الطبقة الحديّة C = ${c_wm.toFixed(4)} mg/g. `;
  if (Math.abs(c_wm) < 0.01 && regWM.r2 >= 0.98) {
    wmInterp +=
      'يمر المنحنى الخطي تقريباً بنقطة الأصل (C ≈ 0)، مما يؤكد أن الانتشار داخل الجسيمات (Intraparticle Diffusion) هو الخطوة الوحيدة المحددة لسرعة الامتزاز.';
  } else if (c_wm > 0) {
    wmInterp += `وجود قيمة موجبة للثابت C (C = ${c_wm.toFixed(4)} > 0) يشير إلى وجود تأثير للطبقة الحديّة (Boundary Layer Effect) وأن الانتشار الداخلي مشارك ولكنه ليس الخطوة المحددة بمفردها للسرعة.`;
  } else {
    wmInterp += `قيم R² = ${stat_wm.r2.toFixed(4)} تشير إلى امتزاز متعدد المراحل (Multi-stage Adsorption).`;
  }

  // Multi-stage breakdown if N >= 5
  const weberMorrisStages: { stage: number; slope: number; intercept: number; r2: number; tRange: string }[] = [];
  if (N >= 6) {
    const mid = Math.floor(N / 2);
    const seg1_t = t.slice(0, mid);
    const seg1_q = qt.slice(0, mid);
    const reg1 = linearRegression(seg1_t.map((tv) => Math.sqrt(tv)), seg1_q);
    weberMorrisStages.push({
      stage: 1,
      slope: reg1.slope,
      intercept: reg1.intercept,
      r2: reg1.r2,
      tRange: `${seg1_t[0]} - ${seg1_t[seg1_t.length - 1]} min (امتزاز خارجي سريع)`,
    });

    const seg2_t = t.slice(mid);
    const seg2_q = qt.slice(mid);
    const reg2 = linearRegression(seg2_t.map((tv) => Math.sqrt(tv)), seg2_q);
    weberMorrisStages.push({
      stage: 2,
      slope: reg2.slope,
      intercept: reg2.intercept,
      r2: reg2.r2,
      tRange: `${seg2_t[0]} - ${seg2_t[seg2_t.length - 1]} min (انتشار مسامي داخلي وتوازن)`,
    });
  }

  const wmResult: KineticsModelResult = {
    id: 'weberMorris',
    name: 'الانتشار الداخلي (Weber–Morris)',
    nameEn: 'Intraparticle Diffusion',
    pCount: 2,
    pred: pred_wm,
    residuals: qt.map((q, i) => q - pred_wm[i]),
    params: { Kid: kid_wm, C: c_wm },
    formulaText: 'q_t = K_{id} t^{0.5} + C',
    linearFormulaText: 'q_t = K_{id} t^{0.5} + C',
    interpretation: wmInterp,
    linearData: t.map((tv, i) => ({
      x: Math.sqrt(tv),
      y: qt[i],
      labelX: 't^0.5 (min^0.5)',
      labelY: 'qt (mg/g)',
    })),
    ...stat_wm,
  };

  // -------------------------------------------------------------
  // 5. Boyd Model
  // -------------------------------------------------------------
  // F = qt / qe (using qe_pso or qeExp)
  const qeRefForBoyd = qe_pso > 0 ? qe_pso : qeExp;
  const F_values = qt.map((q) => Math.min(0.999, Math.max(0.001, q / qeRefForBoyd)));
  const Bt_values = F_values.map((f) => calculateBoydBt(f));

  const regBoyd = linearRegression(t, Bt_values);
  const B_boyd = regBoyd.slope;
  const intercept_boyd = regBoyd.intercept;

  // Calculate Effective Diffusion Coefficient Di (assuming r = 0.05 cm)
  const r_cm = 0.05; // radius in cm
  const Di_cm2_min = (B_boyd * r_cm * r_cm) / (Math.PI * Math.PI);
  const Di_m2_s = (Di_cm2_min * 1e-4) / 60;

  // Reconstruct predicted qt from Boyd line Bt = B*t + intercept
  const pred_boyd = t.map((tv, i) => {
    // If linear approximation or direct mapping
    const bt_pred = B_boyd * tv + intercept_boyd;
    // Approximated F from Bt
    let f_pred = 0;
    if (bt_pred <= 0) f_pred = 0;
    else if (bt_pred > 2.5) f_pred = 1 - Math.exp(-bt_pred - 0.4977);
    else f_pred = (3 / Math.PI) * (1 - Math.pow(1 - Math.sqrt(bt_pred / Math.PI), 2));
    f_pred = Math.min(1, Math.max(0, f_pred));
    return qeRefForBoyd * f_pred;
  });

  const stat_boyd = calculateStatMetrics(qt, pred_boyd, 2);

  let boydInterp = `مخروط خط بؤيد الباقي Intercept = ${intercept_boyd.toFixed(4)} والمعامل B = ${B_boyd.toFixed(5)} min⁻¹. `;
  if (Math.abs(intercept_boyd) < 0.05 && regBoyd.r2 >= 0.95) {
    boydInterp +=
      'بما أن الرسم البياني لـ Bt مقابل t خطي ويمر بنقطة الأصل (Intercept ≈ 0)، فإن الانتشار المسامي الداخلي (Particle Diffusion) هو الخطوة السائدة المحددة لمعدل نقل المادة.';
  } else {
    boydInterp +=
      'عدم مرور خط Bt بنقطة الأصل (Intercept ≠ 0) يؤكد علمياً أن انتشار الفيلم الخارجي (Film Diffusion / External Mass Transfer) يشارك في التحكم في معدل امتزاز المادة.';
  }

  const boydResult: KineticsModelResult = {
    id: 'boyd',
    name: 'موديل بؤيد (Boyd Model)',
    nameEn: 'Boyd Model',
    pCount: 2,
    pred: pred_boyd,
    residuals: qt.map((q, i) => q - pred_boyd[i]),
    params: {
      B: B_boyd,
      intercept: intercept_boyd,
      Di_cm2_min: Di_cm2_min,
      Di_m2_s: Di_m2_s,
    },
    formulaText: 'B_t = -0.4977 - \\ln(1 - F)',
    linearFormulaText: 'B_t = B \\cdot t + I',
    interpretation: boydInterp,
    linearData: t.map((tv, i) => ({
      x: tv,
      y: Bt_values[i],
      labelX: 'Time t (min)',
      labelY: 'Bt (Boyd Parameter)',
    })),
    ...stat_boyd,
  };

  // -------------------------------------------------------------
  // 6. Film Diffusion Model
  // -------------------------------------------------------------
  // -ln(1 - F) = Kfd * t + Intercept
  const Y_film = F_values.map((f) => -Math.log(1 - f));
  const regFilm = linearRegression(t, Y_film);
  const kfd_film = regFilm.slope;
  const intercept_film = regFilm.intercept;

  const pred_film = t.map((tv) => predFilmDiffusion(tv, qeRefForBoyd, kfd_film, intercept_film));
  const stat_film = calculateStatMetrics(qt, pred_film, 2);

  let filmInterp = `ثابت انتشار الفيلم السائل Kfd = ${kfd_film.toFixed(4)} min⁻¹ بمعامل تحديد R² = ${stat_film.r2.toFixed(4)}. `;
  if (stat_film.r2 >= 0.95) {
    filmInterp +=
      'المطابقة العالية تثبت أن مقاومة النقل الكتلي عبر الغشاء السائل الخارجي (Liquid Film Mass Transfer) تشكل حجزاً كبيراً لسرعة العملية.';
  } else {
    filmInterp += 'انخفاض R² يشير إلى أن الانتشار الداخلي يتغلب على انتشار الفيلم بعد المرحلة الأولى.';
  }

  const filmResult: KineticsModelResult = {
    id: 'filmDiffusion',
    name: 'انتشار الفيلم السائل (Film Diffusion)',
    nameEn: 'Film Diffusion',
    pCount: 2,
    pred: pred_film,
    residuals: qt.map((q, i) => q - pred_film[i]),
    params: { Kfd: kfd_film, intercept: intercept_film },
    formulaText: '-\\ln(1 - F) = K_{fd} t',
    linearFormulaText: '-\\ln(1 - F) = K_{fd} t + C',
    interpretation: filmInterp,
    linearData: t.map((tv, i) => ({
      x: tv,
      y: Y_film[i],
      labelX: 'Time t (min)',
      labelY: '-ln(1 - F)',
    })),
    ...stat_film,
  };

  const modelsList = [pfoResult, psoResult, elovichResult, wmResult, boydResult, filmResult];
  const rankedModels = [...modelsList].sort((a, b) => a.aic - b.aic);
  rankedModels.forEach((m, idx) => {
    m.rank = idx + 1;
  });

  // Overall scientific interpretation summary across all 6 kinetics models
  const bestModel = rankedModels[0];
  let overallInterpretation = `استناداً إلى معيار AIC والتقييم الإحصائي الشامل للنماذج الستة، يُعد **${bestModel.name}** هو الموديل الأكثر دقة في وصف حركية الامتزاز (R² = ${bestModel.r2.toFixed(4)}، RMSE = ${bestModel.rmse.toFixed(4)}). `;

  if (bestModel.id === 'pso') {
    overallInterpretation +=
      'تفوّق نموذج الرتبة الثانية الكاذبة (PSO) يؤكد أن العملية تتبع آلية **الامتزاز الكيميائي (Chemisorption)**، حيث تكون الخطوة المحددة للسرعة هي التفاعل الكيميائي وتكوين روابط إلكترونية بين المادة الممتزة والسطح.';
  } else if (bestModel.id === 'pfo') {
    overallInterpretation +=
      'تفوّق نموذج الرتبة الأولى الكاذبة (PFO) يشير إلى أن الامتزاز يتبع آلية فيزيائية مرنة تعتمد على تركيز المواقع الشاغرة المتاحة.';
  } else if (bestModel.id === 'elovich') {
    overallInterpretation +=
      'تفوّق نموذج إلوفيتش (Elovich) يبرهن على عدم تجانس السطح الماص (Energetically Heterogeneous Surface) وتغير طاقة تنشيط الامتزاز مع زيادة التغطية.';
  } else if (bestModel.id === 'weberMorris' || bestModel.id === 'boyd') {
    overallInterpretation +=
      'تفوّق نموذج الانتشار الداخلي/بؤيد يدل على أن **الانتشار المسامي الداخلي (Intraparticle Diffusion)** هو الآلية الرئيسية المحددة لنقل المادة إلى داخل المسامات.';
  } else {
    overallInterpretation +=
      'النتائج تشير إلى تداخل آليتي انتشار الفيلم الخارجي والامتزاز الكيميائي.';
  }

  return {
    t,
    Ct,
    qt,
    C0kin: c0kin,
    W: w,
    V: v,
    qeExp,
    models: {
      pfo: pfoResult,
      pso: psoResult,
      elovich: elovichResult,
      weberMorris: wmResult,
      boyd: boydResult,
      filmDiffusion: filmResult,
    },
    rankedModels,
    overallInterpretation,
    weberMorrisStages,
  };
}
