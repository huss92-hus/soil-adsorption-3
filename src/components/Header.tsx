import React from 'react';
import { FlaskConical, Download, FolderOpen, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onSaveProject: () => void;
  onLoadProject: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetAll: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSaveProject,
  onLoadProject,
  onResetAll,
}) => {
  return (
    <header className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3 text-right">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              نظام نمذجة وحركية الإمتزاز الإحصائي المتقدم
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              مختبر احترافي شامل لنمذجة توازن وحركية الإمتزاز (Isotherms & Adsorption Kinetics) مع التقييم الإحصائي والتفسير العلمي والتصدير
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onSaveProject}
            className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs px-3 py-2 rounded-xl font-medium transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            حفظ المشروع (JSON)
          </button>

          <label className="flex items-center gap-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 text-xs px-3 py-2 rounded-xl font-medium transition shadow-sm cursor-pointer">
            <FolderOpen className="w-3.5 h-3.5" />
            فتح مشروع
            <input type="file" accept=".json" onChange={onLoadProject} className="hidden" />
          </label>

          <button
            onClick={onResetAll}
            className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs px-3 py-2 rounded-xl font-medium transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            إعادة ضبط
          </button>
        </div>
      </div>
    </header>
  );
};
