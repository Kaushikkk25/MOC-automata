import React from 'react';
import {
  Cpu,
  Swords,
  Layers,
  Award,
  Download,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Home
} from 'lucide-react';

interface NavigationHeaderProps {
  currentMode: 'wizard' | 'pumping' | 'conversion' | 'practice';
  onNavigate: (mode: 'wizard' | 'pumping' | 'conversion' | 'practice') => void;
  onOpenExport: () => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  currentMode,
  onNavigate,
  onOpenExport,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('wizard')}
            className="flex items-center gap-3 group text-left"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 12h8"></path>
                <path d="M12 8v8"></path>
              </svg>
            </div>
            <div>
              <div className="font-bold text-base md:text-lg tracking-tight text-slate-900 group-hover:text-indigo-600 transition">
                AutomataStudio
              </div>
              <div className="text-[11px] font-medium text-slate-400 -mt-0.5">
                Models of Computation
              </div>
            </div>
          </button>

          {/* Breadcrumb if inside module */}
          {currentMode !== 'wizard' && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pl-4 border-l border-gray-200">
              <button
                onClick={() => onNavigate('wizard')}
                className="hover:text-slate-900 transition font-medium"
              >
                Overview
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="font-semibold text-indigo-600">
                {currentMode === 'pumping'
                  ? 'Pumping Lemma'
                  : currentMode === 'conversion'
                  ? 'Conversion Studio'
                  : 'Practice Problems'}
              </span>
            </div>
          )}
        </div>

        {/* Center Module Switcher Nav */}
        <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
          <button
            onClick={() => onNavigate('wizard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              currentMode === 'wizard'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Step 1: Module Selector"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Step 1 (Select)</span>
          </button>

          <button
            onClick={() => onNavigate('pumping')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              currentMode === 'pumping'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Pumping Lemma</span>
          </button>

          <button
            onClick={() => onNavigate('conversion')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              currentMode === 'conversion'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Conversion</span>
          </button>

          <button
            onClick={() => onNavigate('practice')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              currentMode === 'practice'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Practice</span>
          </button>
        </div>

        {/* Right Tools & Version */}
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-slate-700 border border-gray-200 text-xs font-semibold transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Export LaTeX / TikZ</span>
          </button>
          <span className="hidden lg:inline text-slate-400 text-[11px]">v2.4.0-stable</span>
        </div>
      </div>
    </header>
  );
};
