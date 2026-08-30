import React from 'react';
import {
  Swords,
  Layers,
  Award,
  ArrowRight,
  CheckCircle2,
  Cpu
} from 'lucide-react';

interface WizardLandingProps {
  onSelectMode: (mode: 'pumping' | 'conversion' | 'practice') => void;
}

export const WizardLanding: React.FC<WizardLandingProps> = ({ onSelectMode }) => {
  return (
    <div className="w-full max-w-6xl mx-auto py-4 px-2 sm:px-4 space-y-10 animate-in fade-in duration-300">
      {/* Header Section from Clean Minimalism Spec */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Models of Computation
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Step 1 of 3: Choose a calculation engine to begin your session.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end">
            <div className="flex gap-2 mb-2">
              <div className="w-12 h-1.5 bg-indigo-600 rounded-full"></div>
              <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
              <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
            </div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-tighter">
              Current Phase: Initialization
            </span>
          </div>
        </div>

        <div className="h-[1px] w-full bg-gray-200"></div>
      </div>

      {/* The 3 Core Mode Selection Cards from Clean Minimalism Spec */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Card 1: Pumping Lemma */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
            Pumping Lemma
          </h2>

          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Engage in adversarial proofs for non-regular and non-context-free languages. Formalize the strings, partitioning, and pump limits.
          </p>

          {/* Feature details */}
          <div className="space-y-2 mb-8 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Interactive Adversarial Prover</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Regular & CFL Proof Engines</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>LaTeX Proof Document Export</span>
            </div>
          </div>

          <div className="mt-auto">
            <button
              onClick={() => onSelectMode('pumping')}
              className="w-full py-3 bg-slate-900 text-white rounded-lg font-semibold text-sm hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Open System</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 2: Conversion (Featured) */}
        <div className="bg-white border-2 border-indigo-500 rounded-2xl p-8 flex flex-col shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 uppercase rounded-bl-lg tracking-wider">
            Popular
          </div>

          <div className="w-14 h-14 bg-indigo-600 text-white rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-md shadow-indigo-200">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 1l4 4-4 4"></path>
              <path d="M3 5h18"></path>
              <path d="M7 23l-4-4 4-4"></path>
              <path d="M21 19H3"></path>
            </svg>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
            Conversion
          </h2>

          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Transform Finite Automata (NFA to DFA), simplify Regular Expressions, or minimize state counts using standard algorithms.
          </p>

          {/* Feature details */}
          <div className="space-y-2 mb-8 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Thompson's Regex → NFA</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>NFA → DFA Subset Powerset</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Hopcroft Minimization & CYK</span>
            </div>
          </div>

          <div className="mt-auto">
            <button
              onClick={() => onSelectMode('conversion')}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Select Engine</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 3: Practice Problems */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-emerald-700 transition-colors">
            Practice Problems
          </h2>

          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Access a curated library of interactive challenges. Sketch automata diagrams and verify against test cases instantly.
          </p>

          {/* Feature details */}
          <div className="space-y-2 mb-8 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Automated Test Vectors & Grading</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>DFA, NFA, PDA & Turing Machines</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Hints, Explanations & Solved Badges</span>
            </div>
          </div>

          <div className="mt-auto">
            <button
              onClick={() => onSelectMode('practice')}
              className="w-full py-3 border border-gray-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Browse Tasks</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Quick Feature Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-gray-200 text-xs text-slate-500">
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="font-bold text-slate-900 mb-1">DFA / NFA / ε-NFA</div>
          <div>Drag-and-drop state canvas & tracer</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="font-bold text-slate-900 mb-1">PDA & Turing Machines</div>
          <div>Stack & Tape multi-step simulation</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="font-bold text-slate-900 mb-1">GNFA State Elimination</div>
          <div>DFA to Regex reduction formulas</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="font-bold text-slate-900 mb-1">CYK Parsing Engine</div>
          <div>Chomsky Normal Form table generator</div>
        </div>
      </div>
    </div>
  );
};
