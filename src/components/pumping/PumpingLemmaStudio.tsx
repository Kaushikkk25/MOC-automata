import React, { useState } from 'react';
import { PUMPING_LEMMA_LANGUAGES } from '../../utils/pumpingLemmaEngine';
import { PumpingLemmaLanguage } from '../../types/automata';
import {
  ShieldAlert,
  Swords,
  BookOpen,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronRight,
  ArrowRight,
  Info,
  HelpCircle
} from 'lucide-react';

export const PumpingLemmaStudio: React.FC = () => {
  const [selectedLangId, setSelectedLangId] = useState<string>(PUMPING_LEMMA_LANGUAGES[0].id);
  const [activeTab, setActiveTab] = useState<'game' | 'proof'>('game');

  const selectedLang =
    PUMPING_LEMMA_LANGUAGES.find((l) => l.id === selectedLangId) || PUMPING_LEMMA_LANGUAGES[0];

  // Game state
  const [p, setP] = useState<number>(3);
  const [selectedW, setSelectedW] = useState<string>(selectedLang.sampleStrings(3)[0]?.value || '');
  const [customW, setCustomW] = useState<string>('');
  const [selectedSplitIdx, setSelectedSplitIdx] = useState<number>(0);
  const [pumpExponent, setPumpExponent] = useState<number>(0);
  const [hasPumped, setHasPumped] = useState<boolean>(false);
  const [copiedLatex, setCopiedLatex] = useState<boolean>(false);

  // When language changes, reset game
  const handleLanguageChange = (lang: PumpingLemmaLanguage) => {
    setSelectedLangId(lang.id);
    const newP = 3;
    setP(newP);
    setSelectedW(lang.sampleStrings(newP)[0]?.value || '');
    setCustomW('');
    setSelectedSplitIdx(0);
    setPumpExponent(0);
    setHasPumped(false);
  };

  const sampleStrings = selectedLang.sampleStrings(p);
  const currentW = customW.trim() || selectedW || sampleStrings[0]?.value || '';
  const validSplits = selectedLang.validSplits(currentW, p);
  const activeSplit = validSplits[selectedSplitIdx] || validSplits[0] || { x: '', y: 'a', z: '' };

  const pumpResult = selectedLang.testPump(activeSplit, pumpExponent);

  const copyProofLatex = () => {
    const proofText = `\\begin{theorem}
${selectedLang.formalProof.theorem}
\\end{theorem}
\\begin{proof}
${selectedLang.formalProof.choiceOfW}
\\\\
${selectedLang.formalProof.adversarySplits}
\\\\
${selectedLang.formalProof.contradictionCase}
\\\\
${selectedLang.formalProof.conclusion}
\\end{proof}`;
    navigator.clipboard.writeText(proofText);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Language Selector */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">
                Adversarial Proof Studio
              </span>
              <span className="text-xs font-mono text-slate-500">
                {selectedLang.type === 'regular' ? 'Regular Pumping Lemma' : 'Context-Free Pumping Lemma'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {selectedLang.name}
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              {selectedLang.description}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-xl border border-gray-200 self-start">
            <button
              onClick={() => setActiveTab('game')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'game'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              Adversarial Game
            </button>
            <button
              onClick={() => setActiveTab('proof')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'proof'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Formal Proof & LaTeX
            </button>
          </div>
        </div>

        {/* Language Tabs Carousel */}
        <div className="pt-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Select Language to Disprove:
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {PUMPING_LEMMA_LANGUAGES.map((lang) => {
              const isSel = lang.id === selectedLangId;
              return (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageChange(lang)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium text-left border transition ${
                    isSel
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm font-semibold'
                      : 'bg-white border-gray-200 text-slate-600 hover:border-gray-300 hover:text-slate-900'
                  }`}
                >
                  <div className="font-semibold">{lang.name.split(':')[0]}</div>
                  <div className="font-mono text-[11px] opacity-75">{lang.formulaLatex.replace(/\\mid/g, '|').replace(/\\{/g, '{').replace(/\\}/g, '}').replace(/\\ge/g, '≥')}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content: Adversarial Game or Formal Proof */}
      {activeTab === 'game' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Main: Game Steps */}
          <div className="lg:col-span-8 space-y-5">
            {/* Step 1: Adversary chooses p */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 font-bold flex items-center justify-center text-xs border border-rose-200">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Adversary chooses Pumping Length (p)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Adversary claims L is regular / CFL with pumping length p.
                    </p>
                  </div>
                </div>
                <div className="text-xs font-mono font-bold px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  p = {p}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <span className="text-xs text-slate-500">Pumping Length p:</span>
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={p}
                  onChange={(e) => {
                    const newP = parseInt(e.target.value);
                    setP(newP);
                    setSelectedW(selectedLang.sampleStrings(newP)[0]?.value || '');
                    setCustomW('');
                  }}
                  className="flex-1 accent-indigo-600 cursor-pointer"
                />
                <div className="flex items-center gap-1.5">
                  {[2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setP(val);
                        setSelectedW(selectedLang.sampleStrings(val)[0]?.value || '');
                        setCustomW('');
                      }}
                      className={`px-2.5 py-1 text-xs rounded-md font-mono transition ${
                        p === val
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-gray-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Prover chooses w */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs border border-indigo-100">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      You (Prover) choose a string w ∈ L (|w| ≥ p)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select a smart string w parameterized by p to trap the adversary.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sampleStrings.map((sample, idx) => {
                    const isSelected = currentW === sample.value && !customW;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedW(sample.value);
                          setCustomW('');
                          setSelectedSplitIdx(0);
                        }}
                        className={`p-3 rounded-xl text-left border transition ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm'
                            : 'bg-slate-50 border-gray-200 text-slate-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-indigo-600">
                            {sample.label}
                          </span>
                          {sample.isOptimal && (
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Optimal
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-slate-800 truncate mt-1 bg-white px-2 py-1 rounded border border-gray-200">
                          w = "{sample.value}" ({sample.value.length} chars)
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                          {sample.hint}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Custom string input */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Custom w:</span>
                  <input
                    type="text"
                    value={customW}
                    onChange={(e) => {
                      setCustomW(e.target.value);
                      setSelectedSplitIdx(0);
                    }}
                    placeholder={`e.g. ${sampleStrings[0]?.value || ''}`}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {currentW.length < p && (
                    <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> |w| must be ≥ {p}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Adversary partitions w = x y z */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 font-bold flex items-center justify-center text-xs border border-amber-200">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Adversary partitions w = x y z (|xy| ≤ p, |y| ≥ 1)
                    </h3>
                    <p className="text-xs text-slate-500">
                      All valid decompositions the adversary could attempt.
                    </p>
                  </div>
                </div>
              </div>

              {selectedLang.type === 'regular' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {validSplits.map((split, idx) => {
                      const isSelected = selectedSplitIdx === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedSplitIdx(idx)}
                          className={`p-2.5 rounded-xl text-left border transition font-mono text-xs ${
                            isSelected
                              ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-sm'
                              : 'bg-slate-50 border-gray-200 text-slate-600 hover:border-gray-300 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-blue-700">x="{split.x || 'ε'}"</span>
                            <span className="text-amber-800 font-bold bg-amber-100 px-1 rounded">
                              y="{split.y}"
                            </span>
                            <span className="text-purple-700">z="{split.z}"</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            |xy| = {split.x.length + split.y.length} ≤ {p}, |y| = {split.y.length} ≥ 1
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 font-mono text-xs text-slate-700">
                  <span className="text-blue-700">u="{activeSplit.u || 'ε'}"</span>,{' '}
                  <span className="text-amber-800 font-bold">v="{activeSplit.v}"</span>,{' '}
                  <span className="text-slate-600">mid="{activeSplit.w_mid}"</span>,{' '}
                  <span className="text-amber-800 font-bold">y="{activeSplit.y}"</span>,{' '}
                  <span className="text-purple-700">tail="{activeSplit.x || activeSplit.z}"</span>
                </div>
              )}
            </div>

            {/* Step 4: Prover pumps i */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-xs border border-emerald-200">
                    4
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      You (Prover) choose pumping exponent i
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pump the string w' = x yⁱ z to expose a contradiction (w' ∉ L).
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[0, 2, 3, 4, 5].map((iVal) => (
                  <button
                    key={iVal}
                    onClick={() => {
                      setPumpExponent(iVal);
                      setHasPumped(true);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
                      pumpExponent === iVal
                        ? 'bg-emerald-600 text-white shadow-sm scale-105'
                        : 'bg-white hover:bg-gray-50 text-slate-700 border border-gray-300'
                    }`}
                  >
                    <span>i = {iVal}</span>
                    <span className="text-[10px] opacity-75">
                      {iVal === 0 ? '(Pump Down)' : iVal === 2 ? '(Pump Up 2x)' : `(Pump ${iVal}x)`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Realtime Contradiction Verifier & Pumping Visualizer */}
          <div className="lg:col-span-4 space-y-5">
            {/* Visual String Pumping Tape */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                String Decomposition & Pumping Tape
              </h3>

              {/* Decomposition breakdown */}
              <div className="space-y-2 mb-4">
                <div className="text-xs text-slate-500">Original String (w):</div>
                <div className="flex items-center gap-1 font-mono text-xs bg-slate-50 p-2.5 rounded-xl border border-gray-200 overflow-x-auto">
                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    x: "{activeSplit.x || 'ε'}"
                  </span>
                  <span className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                    y: "{activeSplit.y}"
                  </span>
                  <span className="px-2 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    z: "{activeSplit.z}"
                  </span>
                </div>
              </div>

              {/* Pumped String */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Pumped String w' = x y^{pumpExponent} z:</span>
                  <span className="font-mono text-indigo-600 font-bold">
                    Length: {pumpResult.pumpedString.length}
                  </span>
                </div>
                <div className="font-mono text-sm bg-slate-50 p-3 rounded-xl border border-gray-200 text-slate-900 break-all leading-relaxed">
                  <span className="text-blue-700">{activeSplit.x}</span>
                  <span className="text-amber-800 font-bold bg-amber-100 px-1 rounded mx-0.5 underline">
                    {activeSplit.y.repeat(pumpExponent) || 'ε'}
                  </span>
                  <span className="text-purple-700">{activeSplit.z}</span>
                </div>
              </div>

              {/* Contradiction Status Box */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  !pumpResult.inLanguage
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {!pumpResult.inLanguage ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm font-bold text-emerald-800">
                        Contradiction Found! w' ∉ L
                      </span>
                    </>
                  ) : (
                    <>
                      <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <span className="text-sm font-bold text-amber-800">
                        String still in L (w' ∈ L)
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  {pumpResult.reason}
                </p>
              </div>

              {!pumpResult.inLanguage && (
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center gap-2 font-medium">
                  <Sparkles className="w-4 h-4 flex-shrink-0 text-indigo-600" />
                  <span>
                    Proof complete for this split! Adversary loses because no valid split can survive all i.
                  </span>
                </div>
              )}
            </div>

            {/* Quick Rules Cheat Sheet */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-xs text-slate-500 space-y-2 shadow-sm">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                Pumping Lemma Invariants:
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-600">
                <li><strong className="text-slate-900">|xy| ≤ p</strong>: y is trapped within the first p characters.</li>
                <li><strong className="text-slate-900">|y| ≥ 1</strong>: y is non-empty.</li>
                <li><strong className="text-slate-900">∀ i ≥ 0</strong>: xyⁱz must remain in L for L to be regular.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Formal Proof & LaTeX Document View */
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Rigorous Mathematical Proof Document
              </h3>
              <p className="text-xs text-slate-500">
                Formatted step-by-step proof structure with standard first-order logic quantifiers.
              </p>
            </div>

            <button
              onClick={copyProofLatex}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-gray-50 text-slate-700 border border-gray-300 transition shadow-sm"
            >
              {copiedLatex ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copiedLatex ? 'Copied LaTeX!' : 'Copy LaTeX Code'}
            </button>
          </div>

          <div className="space-y-4 max-w-4xl mx-auto font-serif">
            {/* Theorem statement */}
            <div className="p-4 rounded-xl bg-slate-50 border border-gray-200">
              <div className="text-xs font-sans uppercase font-bold text-indigo-600 tracking-wider mb-1">
                Theorem
              </div>
              <div className="text-base text-slate-900 italic">
                {selectedLang.formalProof.theorem.replace(/\\\{/g, '{').replace(/\\\}/g, '}').replace(/\\mid/g, '|').replace(/\\ge/g, '≥').replace(/\\text\{/g, '').replace(/\}/g, '')}
              </div>
            </div>

            {/* Proof Body */}
            <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4 text-sm text-slate-800 leading-relaxed">
              <div>
                <strong className="text-indigo-600 font-sans font-bold text-xs uppercase tracking-wider block mb-1">
                  1. Assumption & Choice of String:
                </strong>
                <p>{selectedLang.formalProof.choiceOfW.replace(/\\in/g, '∈').replace(/\\ge/g, '≥')}</p>
              </div>

              <div>
                <strong className="text-amber-700 font-sans font-bold text-xs uppercase tracking-wider block mb-1">
                  2. Adversary Decomposition:
                </strong>
                <p>{selectedLang.formalProof.adversarySplits.replace(/\\le/g, '≤').replace(/\\ge/g, '≥')}</p>
              </div>

              <div>
                <strong className="text-emerald-700 font-sans font-bold text-xs uppercase tracking-wider block mb-1">
                  3. Pumping Contradiction:
                </strong>
                <p>{selectedLang.formalProof.contradictionCase.replace(/\\notin/g, '∉').replace(/\\ne/g, '≠')}</p>
              </div>

              <div>
                <strong className="text-purple-700 font-sans font-bold text-xs uppercase tracking-wider block mb-1">
                  4. Conclusion:
                </strong>
                <p>{selectedLang.formalProof.conclusion}</p>
              </div>

              <div className="text-right text-slate-600 font-bold font-sans">∎ Q.E.D.</div>
            </div>

            {/* Quantifier Breakdown Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-gray-200 text-xs font-sans text-slate-700">
              <strong className="text-indigo-600 font-semibold block mb-2">
                Quantifier Alternation Structure:
              </strong>
              <div className="font-mono bg-white p-3 rounded-lg border border-gray-200 text-slate-900">
                (∀ p ≥ 1) (∃ w ∈ L, |w| ≥ p) (∀ x,y,z: w = xyz, |xy| ≤ p, |y| ≥ 1) (∃ i ≥ 0): xyⁱz ∉ L
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
