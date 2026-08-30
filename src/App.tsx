import React, { useState } from 'react';
import { NavigationHeader } from './components/NavigationHeader';
import { WizardLanding } from './components/WizardLanding';
import { PumpingLemmaStudio } from './components/pumping/PumpingLemmaStudio';
import { ConversionStudio } from './components/conversion/ConversionStudio';
import { PracticeStudio } from './components/practice/PracticeStudio';
import { ExportModal } from './components/ExportModal';

export default function App() {
  const [currentMode, setCurrentMode] = useState<'wizard' | 'pumping' | 'conversion' | 'practice'>('wizard');
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Top sticky Navigation Header */}
      <NavigationHeader
        currentMode={currentMode}
        onNavigate={setCurrentMode}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {currentMode === 'wizard' && (
          <WizardLanding onSelectMode={(mode) => setCurrentMode(mode)} />
        )}

        {currentMode === 'pumping' && <PumpingLemmaStudio />}

        {currentMode === 'conversion' && <ConversionStudio />}

        {currentMode === 'practice' && <PracticeStudio />}
      </main>

      {/* Footer with Clean Minimalism Theme */}
      <footer className="w-full bg-white border-t border-gray-200 py-4 px-6 md:px-12 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-700">&copy; 2026 Formal Computing Lab</span>
            <span className="text-slate-400">AutomataStudio</span>
            <span className="hidden md:inline text-slate-400 font-mono text-[11px]">Chomsky Hierarchy: Regular ⊂ CFL ⊂ CSL ⊂ RE</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>System Ready: All Cores Operational</span>
          </div>
        </div>
      </footer>

      {/* Export Modal */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
