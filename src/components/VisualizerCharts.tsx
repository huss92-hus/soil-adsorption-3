import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  LineChart,
  Line,
} from 'recharts';
import { KineticsAnalysisResults } from '../types';

interface KineticsVisualizerProps {
  results: KineticsAnalysisResults;
}

export const KineticsVisualizer: React.FC<KineticsVisualizerProps> = ({ results }) => {
  const [activeTab, setActiveTab] = useState<'fit' | 'residuals' | 'parity' | 'linear'>('fit');
  const [selectedResidModel, setSelectedResidModel] = useState<string>('pfo');
  const [selectedLinearModel, setSelectedLinearModel] = useState<string>('weberMorris');

  const { t, qt, models } = results;

  // Colors for 6 kinetics models
  const modelColors: Record<string, { stroke: string; name: string }> = {
    pfo: { stroke: '#06b6d4', name: 'PFO (الرتبة الأولى)' },
    pso: { stroke: '#8b5cf6', name: 'PSO (الرتبة الثانية)' },
    elovich: { stroke: '#f59e0b', name: 'Elovich (إلوفيتش)' },
    weberMorris: { stroke: '#10b981', name: 'Weber–Morris (الانتشار الداخلي)' },
    boyd: { stroke: '#ec4899', name: 'Boyd Model (بؤيد)' },
    filmDiffusion: { stroke: '#3b82f6', name: 'Film Diffusion (انتشار الفيلم)' },
  };

  // 1. Experimental vs Predicted Data
  const expData = t.map((tv, i) => ({
    x: tv,
    exp: Number(qt[i].toFixed(4)),
  }));

  // Smooth line interpolation points for smooth curve plotting
  const maxT = Math.max(...t);
  const smoothPointsCount = 60;
  const smoothT = Array.from({ length: smoothPointsCount + 1 }, (_, i) => (maxT * i) / smoothPointsCount);

  // Recharts payload for fit chart
  const fitCurveData = smoothT.map((tv) => {
    return {
      t: Number(tv.toFixed(2)),
      pfo: Number((models.pfo ? models.pfo.params.qe * (1 - Math.exp(-models.pfo.params.k1 * tv)) : 0).toFixed(4)),
      pso: Number((models.pso ? (models.pso.params.k2 * Math.pow(models.pso.params.qe, 2) * tv) / (1 + models.pso.params.k2 * models.pso.params.qe * tv) : 0).toFixed(4)),
      elovich: Number((models.elovich ? (1 / models.elovich.params.beta) * Math.log(Math.max(1, 1 + models.elovich.params.alpha * models.elovich.params.beta * tv)) : 0).toFixed(4)),
      weberMorris: Number((models.weberMorris ? models.weberMorris.params.Kid * Math.sqrt(tv) + models.weberMorris.params.C : 0).toFixed(4)),
      boyd: Number((models.boyd ? (function() {
        const bt = models.boyd.params.B * tv + models.boyd.params.intercept;
        let f = 0;
        if (bt > 2.5) f = 1 - Math.exp(-bt - 0.4977);
        else if (bt > 0) f = (3 / Math.PI) * (1 - Math.pow(1 - Math.sqrt(bt / Math.PI), 2));
        return Math.min(1, Math.max(0, f)) * results.qeExp;
      })() : 0).toFixed(4)),
      filmDiffusion: Number((models.filmDiffusion ? results.qeExp * (1 - Math.exp(-Math.max(0, models.filmDiffusion.params.Kfd * tv + models.filmDiffusion.params.intercept))) : 0).toFixed(4)),
    };
  });

  // 2. Residuals Data
  const currentResidModel = models[selectedResidModel as keyof typeof models] || models.pfo;
  const residualData = t.map((tv, i) => ({
    x: tv,
    residual: Number(currentResidModel.residuals[i].toFixed(4)),
  }));

  // 3. Parity Data (Predicted vs Experimental)
  const parityData = t.map((tv, i) => ({
    exp: Number(qt[i].toFixed(4)),
    pred: Number(currentResidModel.pred[i].toFixed(4)),
  }));
  const minVal = Math.min(...qt) * 0.9;
  const maxVal = Math.max(...qt) * 1.1;

  // 4. Model-Specific Linear Plot Data
  const currentLinearModel = models[selectedLinearModel as keyof typeof models] || models.weberMorris;
  const linearData = currentLinearModel.linearData || [];

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          الرسوم البيانية المتقدمة لحركية الإمتزاز (Kinetics Visualizations)
        </h3>
        <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('fit')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'fit' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            منحنى المطابقة ($q_t$ vs $t$)
          </button>
          <button
            onClick={() => setActiveTab('residuals')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'residuals' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            متبقيات الخطأ (Residuals)
          </button>
          <button
            onClick={() => setActiveTab('parity')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'parity' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            رسم التكافؤ (Parity Plot)
          </button>
          <button
            onClick={() => setActiveTab('linear')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'linear' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            الرسم الخطي الخاص لكل نموذج
          </button>
        </div>
      </div>

      {/* Tab A: Experimental vs Predicted Line Chart */}
      {activeTab === 'fit' && (
        <div className="space-y-2">
          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fitCurveData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="t"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Time, t (min)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'qt (mg/g)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                />
                <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }} />

                <Line type="monotone" dataKey="pfo" name="PFO" stroke={modelColors.pfo.stroke} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pso" name="PSO" stroke={modelColors.pso.stroke} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="elovich" name="Elovich" stroke={modelColors.elovich.stroke} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="weberMorris" name="Weber–Morris" stroke={modelColors.weberMorris.stroke} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="boyd" name="Boyd" stroke={modelColors.boyd.stroke} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="filmDiffusion" name="Film Diffusion" stroke={modelColors.filmDiffusion.stroke} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 italic">
            * النقاط التجريبية مقابل المنحنيات النظرية المتوقعة للنماذج الستة
          </div>
        </div>
      )}

      {/* Tab B: Residual Plot */}
      {activeTab === 'residuals' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-300 font-medium">اختر النموذج لعرض المتبقيات:</label>
            <select
              value={selectedResidModel}
              onChange={(e) => setSelectedResidModel(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="pfo">PFO (الرتبة الأولى)</option>
              <option value="pso">PSO (الرتبة الثانية)</option>
              <option value="elovich">Elovich (إلوفيتش)</option>
              <option value="weberMorris">Weber–Morris (الانتشار الداخلي)</option>
              <option value="boyd">Boyd Model (بؤيد)</option>
              <option value="filmDiffusion">Film Diffusion (انتشار الفيلم)</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="x" stroke="#94a3b8" label={{ value: 'Time, t (min)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                <YAxis dataKey="residual" stroke="#94a3b8" label={{ value: 'Residual (qt_exp - qt_pred)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8' }} />
                <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Scatter name="Residuals" data={residualData} fill="#06b6d4" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab C: Parity Plot */}
      {activeTab === 'parity' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-300 font-medium">اختر النموذج لرسم التكافؤ (Predicted vs Exp):</label>
            <select
              value={selectedResidModel}
              onChange={(e) => setSelectedResidModel(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="pfo">PFO (الرتبة الأولى)</option>
              <option value="pso">PSO (الرتبة الثانية)</option>
              <option value="elovich">Elovich (إلوفيتش)</option>
              <option value="weberMorris">Weber–Morris (الانتشار الداخلي)</option>
              <option value="boyd">Boyd Model (بؤيد)</option>
              <option value="filmDiffusion">Film Diffusion (انتشار الفيلم)</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="exp" type="number" domain={[minVal, maxVal]} stroke="#94a3b8" label={{ value: 'Experimental qt (mg/g)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                <YAxis dataKey="pred" type="number" domain={[minVal, maxVal]} stroke="#94a3b8" label={{ value: 'Predicted qt (mg/g)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8' }} />
                <ReferenceLine segment={[{ x: minVal, y: minVal }, { x: maxVal, y: maxVal }]} stroke="#10b981" strokeDasharray="3 3" label="Ideal 1:1" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Scatter name="Points" data={parityData} fill="#ec4899" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab D: Model-Specific Linear Plots */}
      {activeTab === 'linear' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs text-slate-300 font-medium">اختر النموذج الخطي المراد رسمه:</label>
            <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setSelectedLinearModel('weberMorris')}
                className={`px-2.5 py-1 rounded transition ${selectedLinearModel === 'weberMorris' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
              >
                Weber–Morris ($q_t$ vs $t^{0.5}$)
              </button>
              <button
                onClick={() => setSelectedLinearModel('boyd')}
                className={`px-2.5 py-1 rounded transition ${selectedLinearModel === 'boyd' ? 'bg-pink-600 text-white' : 'text-slate-400'}`}
              >
                Boyd ($B_t$ vs $t$)
              </button>
              <button
                onClick={() => setSelectedLinearModel('elovich')}
                className={`px-2.5 py-1 rounded transition ${selectedLinearModel === 'elovich' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
              >
                Elovich ($q_t$ vs $\ln t$)
              </button>
              <button
                onClick={() => setSelectedLinearModel('filmDiffusion')}
                className={`px-2.5 py-1 rounded transition ${selectedLinearModel === 'filmDiffusion' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              >
                Film Diffusion ($-\ln(1-F)$ vs $t$)
              </button>
              <button
                onClick={() => setSelectedLinearModel('pso')}
                className={`px-2.5 py-1 rounded transition ${selectedLinearModel === 'pso' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
              >
                PSO ($t/q_t$ vs $t$)
              </button>
              <button
                onClick={() => setSelectedLinearModel('pfo')}
                className={`px-2.5 py-1 rounded transition ${selectedLinearModel === 'pfo' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
              >
                PFO ($\ln(q_e-q_t)$ vs $t$)
              </button>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="x"
                  stroke="#94a3b8"
                  label={{ value: linearData[0]?.labelX || 'X', position: 'insideBottom', offset: -10, fill: '#94a3b8' }}
                />
                <YAxis
                  dataKey="y"
                  stroke="#94a3b8"
                  label={{ value: linearData[0]?.labelY || 'Y', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8' }}
                />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Scatter name="Linear Data Points" data={linearData} fill="#f59e0b" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
