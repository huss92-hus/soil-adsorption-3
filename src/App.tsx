import React, { useState } from 'react';
import { Header } from './components/Header';
import { IsothermSection } from './components/IsothermSection';
import { KineticsSection } from './components/KineticsSection';
import { IsothermAnalysisResults, ProjectState } from './types';
import { Activity, Layers } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'kinetics' | 'isotherms'>('kinetics');

  // Shared Physical Parameters
  const [weightW, setWeightW] = useState<number>(1.0);
  const [volumeV, setVolumeV] = useState<number>(0.05);
  const [temperatureT, setTemperatureT] = useState<number>(25.0);
  const [tempUnit, setTempUnit] = useState<'C' | 'K'>('C');
  const [fittingMode, setFittingMode] = useState<'linear' | 'nonlinear'>('linear');

  const [isothermResults, setIsothermResults] = useState<IsothermAnalysisResults | null>(null);

  // Save Project as JSON file
  const handleSaveProject = () => {
    const project: ProjectState = {
      weightW,
      volumeV,
      temperatureT,
      tempUnit,
      fittingMode,
      points: [],
      kinC0: 50.0,
      kinPoints: [],
      timestamp: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Adsorption_Modeling_Project_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Load Project from JSON file
  const handleLoadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const project: ProjectState = JSON.parse(e.target?.result as string);
        if (project.weightW) setWeightW(project.weightW);
        if (project.volumeV) setVolumeV(project.volumeV);
        if (project.temperatureT) setTemperatureT(project.temperatureT);
        if (project.tempUnit) setTempUnit(project.tempUnit);
        if (project.fittingMode) setFittingMode(project.fittingMode);
        alert('تم تحميل بيانات المشروع بنجاح.');
      } catch (err) {
        alert('خطأ في قراءة ملف المشروع، يرجى التأكد من صحة الملف.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetAll = () => {
    setWeightW(1.0);
    setVolumeV(0.05);
    setTemperatureT(25.0);
    setTempUnit('C');
    setFittingMode('linear');
    setIsothermResults(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 pb-20 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Header
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
          onResetAll={handleResetAll}
        />

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-full sm:w-fit mx-auto shadow-lg">
          <button
            onClick={() => setActiveTab('kinetics')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'kinetics'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Phase 3: حركية الإمتزاز (Adsorption Kinetics)
          </button>
          <button
            onClick={() => setActiveTab('isotherms')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'isotherms'
                ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            نماذج توازن الإمتزاز (Isotherms)
          </button>
        </div>

        {/* Active Tab Content */}
        {activeTab === 'kinetics' ? (
          <KineticsSection
            weightW={weightW}
            volumeV={volumeV}
            fittingMode={fittingMode}
            isothermResults={isothermResults}
          />
        ) : (
          <IsothermSection
            weightW={weightW}
            volumeV={volumeV}
            temperatureT={temperatureT}
            tempUnit={tempUnit}
            fittingMode={fittingMode}
            onWeightChange={setWeightW}
            onVolumeChange={setVolumeV}
            onTempChange={setTemperatureT}
            onTempUnitChange={setTempUnit}
            onFittingModeChange={setFittingMode}
            onResultsCalculated={setIsothermResults}
          />
        )}
      </div>
    </div>
  );
}
