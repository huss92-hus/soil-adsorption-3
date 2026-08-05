import React, { useState } from 'react';
import {
  KineticsAnalysisResults,
  KineticsPoint,
} from '../types';
import { runKineticsAnalysis } from '../utils/kineticsEngines';
import { KineticsVisualizer } from './VisualizerCharts';
import {
  exportToExcel,
  exportToCSV,
  exportToWord,
  exportToPDF,
} from '../utils/exportUtils';
import {
  Play,
  FileSpreadsheet,
  FileText,
  FileCode,
  Download,
  Plus,
  Trash2,
  Sparkles,
  Info,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

interface KineticsSectionProps {
  weightW: number;
  volumeV: number;
  fittingMode: 'linear' | 'nonlinear';
  isothermResults: any;
}

const DEFAULT_KINETICS_POINTS: KineticsPoint[] = [
  { t: 5, ct: 38.2 },
  { t: 15, ct: 28.5 },
  { t: 30, ct: 20.1 },
  { t: 60, ct: 13.4 },
  { t: 90, ct: 9.8 },
  { t: 120, ct: 8.1 },
  { t: 180, ct: 7.2 },
  { t: 240, ct: 6.9 },
];

export const KineticsSection: React.FC<KineticsSectionProps> = ({
  weightW,
  volumeV,
  fittingMode,
  isothermResults,
}) => {
  const [c0kin, setC0kin] = useState<number>(50.0);
  const [points, setPoints] = useState<KineticsPoint[]>(DEFAULT_KINETICS_POINTS);
  const [results, setResults] = useState<KineticsAnalysisResults | null>(null);

  // Quick fill sample dataset
  const handleLoadSample = () => {
    setC0kin(50.0);
    setPoints(DEFAULT_KINETICS_POINTS);
  };

  const handleAddPoint = () => {
    setPoints([...points, { t: 0, ct: 0 }]);
  };

  const handleDeletePoint = (index: number) => {
    setPoints(points.filter((_, i) => i !== index));
  };

  const handlePointChange = (index: number, field: 't' | 'ct', value: number) => {
    const updated = [...points];
    updated[index][field] = value;
    setPoints(updated);
  };

  const handleClear = () => {
    setPoints([]);
    setResults(null);
  };

  const handleRunKinetics = () => {
    if (isNaN(weightW) || weightW <= 0 || isNaN(volumeV) || volumeV <= 0) {
      alert('❌ خطأ: يرجى تحديد وزن المادة الممتزة وحجم المحلول أولاً في القسم الأعلى.');
      return;
    }
    if (isNaN(c0kin) || c0kin <= 0) {
      alert('❌ خطأ: يرجى إدخال تركيز ابتدائي صحيح وموجب C₀ لتجربة الحركية.');
      return;
    }

    const validPoints = points.filter((p) => p.t >= 0 && p.ct >= 0 && !isNaN(p.t) && !isNaN(p.ct));
    if (validPoints.length < 4) {
      alert('❌ تنبيه إحصائي: يتطلب التحليل الحركي المتقدم 4 نقاط زمنية صالحة على الأقل لتحديد R² والتحليل الإحصائي بدقة.');
      return;
    }

    for (let i = 0; i < validPoints.length; i++) {
      if (validPoints[i].ct >= c0kin) {
        alert(`❌ خطأ علمي في النقطة ${i + 1}: التركيز عند الزمن Cₜ (${validPoints[i].ct}) يجب أن يكون أصغر من التركيز الابتدائي C₀ (${c0kin} mg/L).`);
        return;
      }
    }

    const tVals = validPoints.map((p) => p.t);
    const ctVals = validPoints.map((p) => p.ct);
    const qtVals = ctVals.map((c) => ((c0kin - c) * volumeV) / weightW);

    const res = runKineticsAnalysis(tVals, ctVals, qtVals, c0kin, weightW, volumeV, fittingMode);
    setResults(res);
  };

  return (
    <div className="space-y-6" id="kineticsContainer">
      {/* Input Panel */}
      <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <h2 className="text-base font-bold text-slate-100">
              بيانات وتجارب حركية الإمتزاز (Adsorption Kinetics Data)
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleLoadSample}
              className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs px-3 py-1.5 rounded-xl font-medium transition"
            >
              ⚡ تحميل بيانات تجريبية نموذجية
            </button>
            <button
              onClick={handleAddPoint}
              className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> إضافة نقطة
            </button>
            <button
              onClick={handleClear}
              className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs px-3 py-1.5 rounded-xl font-medium transition"
            >
              مسح
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              التركيز الابتدائي للحركية C₀ (mg/L):
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={c0kin}
              onChange={(e) => setC0kin(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <div>
              <span className="text-slate-500 block">وزن المادة W:</span>
              <span className="font-mono text-slate-200 font-bold">{weightW} g</span>
            </div>
            <div className="border-r border-slate-700 pr-3">
              <span className="text-slate-500 block">حجم المحلول V:</span>
              <span className="font-mono text-slate-200 font-bold">{volumeV} L</span>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRunKinetics}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2 px-4 rounded-xl transition shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 text-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              تشغيل تحليلات الحركية الستة (Kinetics Engine)
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/70">
                <th className="p-2.5 text-center w-12">#</th>
                <th className="p-2.5">الزمن t (min)</th>
                <th className="p-2.5">التركيز المتبقي عند الزمن Cₜ (mg/L)</th>
                <th className="p-2.5">السعة اللحظية المحسوبة qₜ (mg/g)</th>
                <th className="p-2.5 text-center w-16">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {points.map((pt, idx) => {
                const qtVal = c0kin > pt.ct ? ((c0kin - pt.ct) * volumeV) / weightW : 0;
                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="p-2.5 text-center text-slate-500">{idx + 1}</td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="any"
                        value={pt.t}
                        onChange={(e) => handlePointChange(idx, 't', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 text-center focus:outline-none focus:border-purple-500"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="any"
                        value={pt.ct}
                        onChange={(e) => handlePointChange(idx, 'ct', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 text-center focus:outline-none focus:border-purple-500"
                      />
                    </td>
                    <td className="p-2.5 text-purple-300 font-bold text-center">
                      {qtVal > 0 ? qtVal.toFixed(4) : '-'}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => handleDeletePoint(idx)}
                        className="text-rose-400 hover:text-rose-300 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-6">
          {/* Export Action Bar */}
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              خيارات التصدير الشامل للنتائج والتقارير
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => exportToExcel(isothermResults, results, { weightW, volumeV, temperatureT: 25, tempUnit: 'C', fittingMode })}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-2 rounded-xl font-medium transition flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                تصدير Excel (.xlsx)
              </button>
              <button
                onClick={() => exportToWord(isothermResults, results, { weightW, volumeV, temperatureT: 25, tempUnit: 'C' })}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs px-3 py-2 rounded-xl font-medium transition flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                تصدير Word (.doc)
              </button>
              <button
                onClick={() => exportToCSV(isothermResults, results)}
                className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs px-3 py-2 rounded-xl font-medium transition flex items-center gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5" />
                تصدير CSV
              </button>
              <button
                onClick={() => exportToPDF('kineticsContainer')}
                className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs px-3 py-2 rounded-xl font-medium transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                تصدير PDF
              </button>
            </div>
          </div>

          {/* Scientific Interpretation Header Banner */}
          <div className="bg-gradient-to-r from-purple-950/60 to-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-xl space-y-2">
            <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-400" />
              التفسير العلمي الشامل لآلية حركية الإمتزاز (Scientific Kinetics Synthesis)
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              {results.overallInterpretation}
            </p>
          </div>

          {/* Unified Kinetics Models Ranking Table */}
          <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              الجدول الموحد لمقارنة نماذج الحركية الستة (Kinetics Models Ranking & Evaluation)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/70">
                    <th className="p-3">الترتيب</th>
                    <th className="p-3">النموذج الحركي</th>
                    <th className="p-3 text-center">المعاملات المقدرة (Parameters)</th>
                    <th className="p-3 text-center">R²</th>
                    <th className="p-3 text-center">Adj R²</th>
                    <th className="p-3 text-center">RMSE</th>
                    <th className="p-3 text-center">MAE</th>
                    <th className="p-3 text-center">AIC</th>
                    <th className="p-3 text-center">BIC</th>
                    <th className="p-3 text-center">التقييم الإحصائي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {results.rankedModels.map((m, idx) => {
                    const paramSummary = Object.entries(m.params)
                      .map(([k, v]) => `${k} = ${typeof v === 'number' ? v.toFixed(4) : v}`)
                      .join('; ');
                    const isBest = idx === 0;
                    return (
                      <tr
                        key={m.id}
                        className={`transition ${isBest ? 'bg-emerald-500/10 font-bold' : 'hover:bg-slate-800/30'}`}
                      >
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              isBest ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            #{m.rank}
                          </span>
                        </td>
                        <td className="p-3 font-sans font-bold text-slate-200">{m.name}</td>
                        <td className="p-3 text-center text-slate-300 text-[11px]">{paramSummary}</td>
                        <td className="p-3 text-center text-cyan-400">{m.r2.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.adjR2.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.rmse.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.mae.toFixed(4)}</td>
                        <td className="p-3 text-center text-purple-300">{m.aic.toFixed(2)}</td>
                        <td className="p-3 text-center text-slate-300">{m.bic.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          {isBest ? (
                            <span className="text-emerald-400 flex items-center justify-center gap-1 text-[11px] font-sans">
                              <CheckCircle2 className="w-3.5 h-3.5" /> الأفضل مطابقة
                            </span>
                          ) : m.r2 >= 0.9 ? (
                            <span className="text-blue-400 text-[11px] font-sans">مقبول جداً</span>
                          ) : (
                            <span className="text-slate-500 text-[11px] font-sans">ضعيف</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Detailed Cards for ALL 6 Kinetics Models */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Elovich */}
            <div className="bg-slate-900/90 backdrop-blur border-l-4 border-amber-500 border-y border-r border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-400">1. نموذج إلوفيتش (Elovich Model)</h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300">
                  R² = {results.models.elovich.r2.toFixed(4)}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-xs font-mono text-amber-200">
                q_t = (1/β) ln(1 + α β t)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">معدل الامتزاز الابتدائي α:</span>
                  <span className="text-slate-100 font-bold">{results.models.elovich.params.alpha.toFixed(4)} mg/(g·min)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ثابت الامتزاز/التنشيط β:</span>
                  <span className="text-slate-100 font-bold">{results.models.elovich.params.beta.toFixed(4)} g/mg</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border-r-2 border-amber-500">
                {results.models.elovich.interpretation}
              </p>
            </div>

            {/* 2. Weber-Morris */}
            <div className="bg-slate-900/90 backdrop-blur border-l-4 border-emerald-500 border-y border-r border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-emerald-400">2. الانتشار الداخلي (Weber–Morris)</h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300">
                  R² = {results.models.weberMorris.r2.toFixed(4)}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-xs font-mono text-emerald-200">
                q_t = K_id t^0.5 + C
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">ثابت الانتشار Kid:</span>
                  <span className="text-slate-100 font-bold">{results.models.weberMorris.params.Kid.toFixed(4)} mg/(g·min^0.5)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">سُمك الطبقة الحدية C:</span>
                  <span className="text-slate-100 font-bold">{results.models.weberMorris.params.C.toFixed(4)} mg/g</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border-r-2 border-emerald-500">
                {results.models.weberMorris.interpretation}
              </p>
            </div>

            {/* 3. Boyd Model */}
            <div className="bg-slate-900/90 backdrop-blur border-l-4 border-pink-500 border-y border-r border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-pink-400">3. نموذج بؤيد (Boyd Model)</h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-pink-500/20 text-pink-300">
                  R² = {results.models.boyd.r2.toFixed(4)}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-xs font-mono text-pink-200">
                B_t = B t + Intercept
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">ثابت بؤيد B (Slope):</span>
                  <span className="text-slate-100 font-bold">{results.models.boyd.params.B.toFixed(5)} min⁻¹</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">المحور الصادي Intercept:</span>
                  <span className="text-slate-100 font-bold">{results.models.boyd.params.intercept.toFixed(4)}</span>
                </div>
                <div className="col-span-2 border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400 block text-[10px]">معامل الانتشار الفعلي Di:</span>
                  <span className="text-pink-300 font-bold text-[11px]">{results.models.boyd.params.Di_cm2_min.toExponential(4)} cm²/min</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border-r-2 border-pink-500">
                {results.models.boyd.interpretation}
              </p>
            </div>

            {/* 4. Film Diffusion */}
            <div className="bg-slate-900/90 backdrop-blur border-l-4 border-blue-500 border-y border-r border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-blue-400">4. انتشار الفيلم السائل (Film Diffusion)</h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-500/20 text-blue-300">
                  R² = {results.models.filmDiffusion.r2.toFixed(4)}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-xs font-mono text-blue-200">
                -ln(1 - F) = K_fd t + C
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">ثابت الفيلم Kfd:</span>
                  <span className="text-slate-100 font-bold">{results.models.filmDiffusion.params.Kfd.toFixed(4)} min⁻¹</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">المقطوع Intercept:</span>
                  <span className="text-slate-100 font-bold">{results.models.filmDiffusion.params.intercept.toFixed(4)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border-r-2 border-blue-500">
                {results.models.filmDiffusion.interpretation}
              </p>
            </div>

            {/* 5. PFO */}
            <div className="bg-slate-900/90 backdrop-blur border-l-4 border-cyan-500 border-y border-r border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-cyan-400">5. الرتبة الأولى الكاذبة (PFO)</h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300">
                  R² = {results.models.pfo.r2.toFixed(4)}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-xs font-mono text-cyan-200">
                q_t = q_e (1 - e^-k1 t)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">السعة المحسوبة qe:</span>
                  <span className="text-slate-100 font-bold">{results.models.pfo.params.qe.toFixed(4)} mg/g</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ثابت السرعة k1:</span>
                  <span className="text-slate-100 font-bold">{results.models.pfo.params.k1.toFixed(5)} min⁻¹</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border-r-2 border-cyan-500">
                {results.models.pfo.interpretation}
              </p>
            </div>

            {/* 6. PSO */}
            <div className="bg-slate-900/90 backdrop-blur border-l-4 border-purple-500 border-y border-r border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-purple-400">6. الرتبة الثانية الكاذبة (PSO)</h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-purple-500/20 text-purple-300">
                  R² = {results.models.pso.r2.toFixed(4)}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-xs font-mono text-purple-200">
                q_t = k2 qe^2 t / (1 + k2 qe t)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">السعة المحسوبة qe:</span>
                  <span className="text-slate-100 font-bold">{results.models.pso.params.qe.toFixed(4)} mg/g</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ثابت السرعة k2:</span>
                  <span className="text-slate-100 font-bold">{results.models.pso.params.k2.toExponential(3)} g/(mg·min)</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border-r-2 border-purple-500">
                {results.models.pso.interpretation}
              </p>
            </div>
          </div>

          {/* Interactive Recharts Visualizations */}
          <KineticsVisualizer results={results} />
        </div>
      )}
    </div>
  );
};
