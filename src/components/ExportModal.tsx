import React, { useState } from 'react';
import { AutomatonDefinition } from '../types/automata';
import { Copy, Check, X, FileText, Code2, Download } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  automaton?: AutomatonDefinition;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, automaton }) => {
  const [activeFormat, setActiveFormat] = useState<'latex_tikz' | 'json' | 'jflap'>('latex_tikz');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate TikZ code
  const generateTikz = () => {
    if (!automaton) return '% No automaton loaded';
    let code = `\\documentclass{article}
\\usepackage{tikz}
\\usetikzlibrary{automata, positioning, arrows}

\\begin{document}
\\begin{tikzpicture}[->, >=stealth', shorten >=1pt, auto, node distance=2.8cm, semithick]
  \\tikzstyle{every state}=[fill=white, draw=black, text=black]

  % States
`;
    automaton.states.forEach((st) => {
      const isStart = st.id === automaton.startStateId;
      const isAccept = automaton.acceptStateIds.includes(st.id);
      let stateStyles = [];
      if (isStart) stateStyles.push('initial');
      if (isAccept) stateStyles.push('accepting');
      stateStyles.push('state');

      code += `  \\node[${stateStyles.join(', ')}] (${st.id}) [above right of=...] {$${st.name}$};\n`;
    });

    code += `\n  % Transitions\n  \\path\n`;
    automaton.transitions.forEach((t) => {
      const sym = t.symbols.join(', ');
      const isSelf = t.from === t.to;
      if (isSelf) {
        code += `    (${t.from}) edge [loop above] node {${sym}} (${t.to})\n`;
      } else {
        code += `    (${t.from}) edge node {${sym}} (${t.to})\n`;
      }
    });

    code += `  ;\n\\end{tikzpicture}\n\\end{document}`;
    return code;
  };

  const generateJSON = () => {
    return JSON.stringify(automaton || {}, null, 2);
  };

  const getContent = () => {
    if (activeFormat === 'latex_tikz') return generateTikz();
    return generateJSON();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = activeFormat === 'latex_tikz' ? 'tex' : 'json';
    const blob = new Blob([getContent()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `automaton_${Date.now()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Export Formal Model</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFormat('latex_tikz')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeFormat === 'latex_tikz'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-gray-200 hover:text-slate-900'
              }`}
            >
              LaTeX (TikZ automata)
            </button>
            <button
              onClick={() => setActiveFormat('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeFormat === 'json'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-gray-200 hover:text-slate-900'
              }`}
            >
              Standard JSON Format
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 bg-slate-50 rounded-xl border border-gray-200 font-mono text-xs text-slate-800 max-h-72 overflow-y-auto leading-relaxed select-all">
              {getContent()}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 text-slate-700 text-xs font-semibold transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download File
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Code!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
};
