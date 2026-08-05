import React, { useState } from 'react';
import {
  IsothermAnalysisResults,
  IsothermPoint,
} from '../types';
import { runIsothermAnalysis } from '../utils/isothermEngines';
import {
  Play,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  LineChart,
} from 'recharts';

interface IsothermSectionProps {
  weightW: number;
  volumeV: number;
  temperatureT: number;
  tempUnit: 'C' | 'K';
  fittingMode: 'linear' | 'nonlinear';
  onWeightChange: (val: number) => void;
  onVolumeChange: (val: number) => void;
  onTempChange: (val: number) => void;
  onTempUnitChange: (val: 'C' | 'K') => void;
  onFittingModeChange: (val: 'linear' | 'nonlinear') => void;
  onResultsCalculated: (res: IsothermAnalysisResults) => void;
}

const DEFAULT_ISOTHERM_POINTS: IsothermPoint[] = [
  { c0: 10, ce: 1.5 },
  { c0: 25, ce: 4.8 },
  { c0: 50, ce: 12.3 },
  { c0: 100, ce: 32.1 },
  { c0: 150, ce: 58.4 },
  { c0: 200, ce: 89.2 },
];

export const IsothermSection: React.FC<IsothermSectionProps> = ({
  weightW,
  volumeV,
  temperatureT,
  tempUnit,
  fittingMode,
  onWeightChange,
  onVolumeChange,
  onTempChange,
  onTempUnitChange,
  onFittingModeChange,
  onResultsCalculated,
}) => {
  const [points, setPoints] = useState<IsothermPoint[]>(DEFAULT_ISOTHERM_POINTS);
  const [results, setResults] = useState<IsothermAnalysisResults | null>(null);

  const handleLoadSample = () => {
    setPoints(DEFAULT_ISOTHERM_POINTS);
  };

  const handleAddPoint = () => {
    setPoints([...points, { c0: 0, ce: 0 }]);
  };

  const handleDeletePoint = (index: number) => {
    setPoints(points.filter((_, i) => i !== index));
  };

  const handlePointChange = (index: number, field: 'c0' | 'ce', value: number) => {
    const updated = [...points];
    updated[index][field] = value;
    setPoints(updated);
  };

  const handleClear = () => {
    setPoints([]);
    setResults(null);
  };

  const handleRunIsotherms = () => {
    if (isNaN(weightW) || weightW <= 0 || isNaN(volumeV) || volumeV <= 0) {
      alert('❌ خطأ: يرجى تحديد وزن المادة الممتزة W وحجم المحلول V بشكل صحيح.');
      return;
    }

    const T_kelvin = tempUnit === 'C' ? temperatureT + 273.15 : temperatureT;

    const validPoints = points.filter((p) => p.c0 > 0 && p.ce > 0 && p.c0 > p.ce);
    if (validPoints.length < 3) {
      alert('❌ تنبيه إحصائي: يلزم وجود 3 نقاط بيانات على الأقل لتشغيل تحليلات نماذج التوازن.');
      return;
    }

    const rawCe = validPoints.map((p) => p.ce);
    const rawC0 = validPoints.map((p) => p.c0);
    const rawQe = validPoints.map((p) => ((p.c0 - p.ce) * volumeV) / weightW);

    const res = runIsothermAnalysis(rawCe, rawQe, rawC0, T_kelvin, fittingMode);
    setResults(res);
    onResultsCalculated(res);
  };

  // Recharts fitting plot data
  const fitCurveData = results
    ? Array.from({ length: 40 }, (_, i) => {
        const maxCe = Math.max(...results.Ce);
        const c = (maxCe * i) / 39 + 0.01;
        const qm = results.models.langmuir.params.qm;
        const kl = results.models.langmuir.params.kl;
        const kf = results.models.freundlich.params.kf;
        const inv_n = results.models.freundlich.params.inv_n;
        return {
          c: Number(c.toFixed(2)),
          langmuir: Number(((qm * kl * c) / (1 + kl * c)).toFixed(4)),
          freundlich: Number((kf * Math.pow(c, inv_n)).toFixed(4)),
        };
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Parameters & Data Table */}
      <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <h2 className="text-base font-bold text-slate-100">
              شروط التجربة وبيانات توازن الإمتزاز (Isotherms Data)
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleLoadSample}
              className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs px-3 py-1.5 rounded-xl font-medium transition"
            >
              ⚡ تحميل بيانات تجريبية نموذجية
            </button>
            <button
              onClick={handleAddPoint}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1"
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

        {/* Physical Conditions Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">وزن المادة W (g):</label>
            <input
              type="number"
              step="any"
              min="0"
              value={weightW}
              onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">حجم المحلول V (L):</label>
            <input
              type="number"
              step="any"
              min="0"
              value={volumeV}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">درجة الحرارة T:</label>
            <div className="flex gap-1">
              <input
                type="number"
                step="any"
                value={temperatureT}
                onChange={(e) => onTempChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              />
              <select
                value={tempUnit}
                onChange={(e) => onTempUnitChange(e.target.value as 'C' | 'K')}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 text-xs text-slate-200"
              >
                <option value="C">°C</option>
                <option value="K">K</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">طريقة التقدير (Fitting Mode):</label>
            <select
              value={fittingMode}
              onChange={(e) => onFittingModeChange(e.target.value as 'linear' | 'nonlinear')}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="linear">التقدير الخطي الكلاسيكي (Linearization)</option>
              <option value="nonlinear">التحسين غير الخطي المباشر (Direct Non-Linear SSE)</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/70">
                <th className="p-2.5 text-center w-12">#</th>
                <th className="p-2.5">التركيز الابتدائي C₀ (mg/L)</th>
                <th className="p-2.5">التركيز عند الاتزان Cₑ (mg/L)</th>
                <th className="p-2.5">سعة الإمتزاز المحسوبة qₑ (mg/g)</th>
                <th className="p-2.5 text-center w-16">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {points.map((pt, idx) => {
                const qeVal = pt.c0 > pt.ce ? ((pt.c0 - pt.ce) * volumeV) / weightW : 0;
                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="p-2.5 text-center text-slate-500">{idx + 1}</td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="any"
                        value={pt.c0}
                        onChange={(e) => handlePointChange(idx, 'c0', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 text-center focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="any"
                        value={pt.ce}
                        onChange={(e) => handlePointChange(idx, 'ce', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 text-center focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-2.5 text-cyan-400 font-bold text-center">
                      {qeVal > 0 ? qeVal.toFixed(4) : '-'}
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

        <button
          onClick={handleRunIsotherms}
          className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 text-sm"
        >
          <Play className="w-4 h-4 fill-current" />
          تشغيل تحليلات النماذج الـ 11 لتوازن الإمتزاز (Isotherm Engine)
        </button>
      </div>

      {/* Isotherm Results Table & Visualizations */}
      {results && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              الجدول الموحد لمقارنة موديلات توازن الإمتزاز الـ 11 (Isotherms Ranking)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/70">
                    <th className="p-3">الترتيب</th>
                    <th className="p-3">الموديل الرياضي</th>
                    <th className="p-3 text-center">R²</th>
                    <th className="p-3 text-center">Adj R²</th>
                    <th className="p-3 text-center">RMSE</th>
                    <th className="p-3 text-center">MSE</th>
                    <th className="p-3 text-center">SSE</th>
                    <th className="p-3 text-center">MAE</th>
                    <th className="p-3 text-center">χ² (Chi-Square)</th>
                    <th className="p-3 text-center">AIC</th>
                    <th className="p-3 text-center">BIC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {results.rankedModels.map((m, idx) => {
                    const isBest = idx === 0;
                    return (
                      <tr
                        key={m.nameEn}
                        className={`transition ${isBest ? 'bg-cyan-500/10 font-bold' : 'hover:bg-slate-800/30'}`}
                      >
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              isBest ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            #{m.rank}
                          </span>
                        </td>
                        <td className="p-3 font-sans font-bold text-slate-200">{m.name}</td>
                        <td className="p-3 text-center text-cyan-400">{m.r2.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.adjR2.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.rmse.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.mse.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.sse.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.mae.toFixed(4)}</td>
                        <td className="p-3 text-center text-slate-300">{m.chiSquare.toFixed(4)}</td>
                        <td className="p-3 text-center text-purple-300">{m.aic.toFixed(2)}</td>
                        <td className="p-3 text-center text-slate-300">{m.bic.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Isotherm Recharts Curve */}
          <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-slate-200">الرسم البياني لتوازن الإمتزاز ($q_e$ vs $C_e$)</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fitCurveData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="c" stroke="#94a3b8" label={{ value: 'Ce (mg/L)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                  <YAxis stroke="#94a3b8" label={{ value: 'qe (mg/g)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="langmuir" name="Langmuir" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="freundlich" name="Freundlich" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
