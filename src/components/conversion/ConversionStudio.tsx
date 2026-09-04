import React, { useState } from 'react';
import { AutomatonDefinition, ContextFreeGrammar, SimulationStep } from '../../types/automata';
import {
  checkAutomataEquivalence,
  convertDFAToRegex,
  convertNFAToDFA,
  convertRegexToNFA,
  generateSampleTestStrings,
  getStateName,
  minimizeDFA,
  parseCYKTable,
  runBatchTests,
  simulateAutomatonStepByStep,
  testAutomatonInput,
} from '../../utils/automataEngine';
import { AutomataCanvas } from '../canvas/AutomataCanvas';
import {
  ArrowRight,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  FileCode,
  Layers,
  Minimize2,
  Table,
  Check,
  FastForward,
  Info,
  Network,
  BarChart3,
  Scale,
  GitCompareArrows
} from 'lucide-react';

// Small reusable stat tile grid — used after every conversion to show
// state/transition counts, accepting-state counts, and the algorithm used.
const StatsGrid: React.FC<{ stats: Array<{ label: string; value: string | number }> }> = ({ stats }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
      <BarChart3 className="w-3.5 h-3.5" />
      Conversion Statistics
    </h4>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {stats.map((s, idx) => (
        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-gray-200">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{s.label}</div>
          <div className="text-lg font-bold text-indigo-700 break-all">{s.value}</div>
        </div>
      ))}
    </div>
  </div>
);

// Original vs Converted Verification — runs a real equivalence check plus a
// sample batch of strings through BOTH automata, side by side, to visibly
// prove the conversion preserved the language (or pinpoint where it didn't).
const VerificationPanel: React.FC<{
  original: AutomatonDefinition;
  converted: AutomatonDefinition;
  originalLabel: string;
  convertedLabel: string;
}> = ({ original, converted, originalLabel, convertedLabel }) => {
  const eq = checkAutomataEquivalence(original, converted);
  const sampleStrings = generateSampleTestStrings(original, 8);

  return (
    <div
      className={`bg-white border rounded-2xl p-5 shadow-sm space-y-3 ${
        eq.equivalent ? 'border-emerald-200' : 'border-rose-200'
      }`}
    >
      <div className="flex items-center gap-2">
        {eq.equivalent ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <XCircle className="w-4 h-4 text-rose-600" />
        )}
        <h4
          className={`text-xs font-bold uppercase tracking-wider ${
            eq.equivalent ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {eq.equivalent
            ? `Verified Equivalent — ${originalLabel} and ${convertedLabel} accept the same language`
            : `Mismatch Found Between ${originalLabel} and ${convertedLabel}`}
        </h4>
      </div>

      {!eq.equivalent && (
        <p className="text-xs text-rose-700 leading-relaxed">
          On input <span className="font-mono font-bold">"{eq.counterexample || 'ε'}"</span>, {originalLabel} says{' '}
          <strong>{eq.acceptedByA ? 'ACCEPT' : 'REJECT'}</strong> but {convertedLabel} says{' '}
          <strong>{eq.acceptedByB ? 'ACCEPT' : 'REJECT'}</strong>.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            <tr className="border-b border-gray-200 text-slate-600 bg-gray-50">
              <th className="p-2.5 font-semibold">Input</th>
              <th className="p-2.5 font-semibold">{originalLabel}</th>
              <th className="p-2.5 font-semibold">{convertedLabel}</th>
              <th className="p-2.5 font-semibold">Match?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sampleStrings.map((tc, idx) => {
              const resA = testAutomatonInput(original, tc.input);
              const resB = testAutomatonInput(converted, tc.input);
              const match = resA === resB;
              return (
                <tr key={idx} className={match ? '' : 'bg-rose-50'}>
                  <td className="p-2.5 text-slate-800">"{tc.input || 'ε'}"</td>
                  <td className={`p-2.5 font-semibold ${resA ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {resA ? 'ACCEPT' : 'reject'}
                  </td>
                  <td className={`p-2.5 font-semibold ${resB ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {resB ? 'ACCEPT' : 'reject'}
                  </td>
                  <td className="p-2.5">
                    {match ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Preset dropdown + "build from regex" quick action, used above every
// embedded canvas so each conversion tab can seed its own input without
// depending on the Simulate tab's shared automaton.
const InputBuilderRow: React.FC<{
  regexValue: string;
  onRegexChange: (v: string) => void;
  onBuild: () => void;
  onPreset: (model: AutomatonDefinition) => void;
  placeholder?: string;
}> = ({ regexValue, onRegexChange, onBuild, onPreset, placeholder }) => (
  <div className="flex flex-wrap items-center gap-2">
    <select
      onChange={(e) => {
        const model = PRESET_MODELS[e.target.value];
        if (model) onPreset(JSON.parse(JSON.stringify(model)));
      }}
      className="bg-white border border-gray-300 text-xs text-slate-900 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none font-mono"
    >
      <option value="">Load preset…</option>
      <option value="dfa_ends_01">DFA: Ends in 01</option>
      <option value="nfa_contains_010">NFA: Contains 010</option>
    </select>
    <input
      type="text"
      value={regexValue}
      onChange={(e) => onRegexChange(e.target.value)}
      placeholder={placeholder || 'Or build from regex, e.g. (a|b)*abb'}
      className="flex-1 min-w-[180px] bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
    <button
      onClick={onBuild}
      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
    >
      Build
    </button>
  </div>
);




// Default initial DFA (Ends with 01)
const INITIAL_DFA: AutomatonDefinition = {
  type: 'DFA',
  alphabet: ['0', '1'],
  states: [
    { id: 'q0', name: 'q0', x: 120, y: 180, isStart: true },
    { id: 'q1', name: 'q1', x: 280, y: 180 },
    { id: 'q2', name: 'q2', x: 440, y: 180, isAccept: true },
  ],
  transitions: [
    { id: 't0', from: 'q0', to: 'q0', symbols: ['1'] },
    { id: 't1', from: 'q0', to: 'q1', symbols: ['0'] },
    { id: 't2', from: 'q1', to: 'q1', symbols: ['0'] },
    { id: 't3', from: 'q1', to: 'q2', symbols: ['1'] },
    { id: 't4', from: 'q2', to: 'q1', symbols: ['0'] },
    { id: 't5', from: 'q2', to: 'q0', symbols: ['1'] },
  ],
  startStateId: 'q0',
  acceptStateIds: ['q2'],
};

// Preset Automata models for quick loading
const PRESET_MODELS: Record<string, AutomatonDefinition> = {
  dfa_ends_01: INITIAL_DFA,
  nfa_contains_010: {
    type: 'NFA',
    alphabet: ['0', '1'],
    states: [
      { id: 's0', name: 'q0', x: 120, y: 180, isStart: true },
      { id: 's1', name: 'q1', x: 260, y: 180 },
      { id: 's2', name: 'q2', x: 400, y: 180 },
      { id: 's3', name: 'q3', x: 540, y: 180, isAccept: true },
    ],
    transitions: [
      { id: 't0', from: 's0', to: 's0', symbols: ['0', '1'] },
      { id: 't1', from: 's0', to: 's1', symbols: ['0'] },
      { id: 't2', from: 's1', to: 's2', symbols: ['1'] },
      { id: 't3', from: 's2', to: 's3', symbols: ['0'] },
      { id: 't4', from: 's3', to: 's3', symbols: ['0', '1'] },
    ],
    startStateId: 's0',
    acceptStateIds: ['s3'],
  },
  pda_an_bn: {
    type: 'PDA',
    alphabet: ['a', 'b'],
    stackAlphabet: ['a', 'Z0'],
    initialStackSymbol: 'Z0',
    states: [
      { id: 'p0', name: 'q0 (Push a)', x: 140, y: 180, isStart: true },
      { id: 'p1', name: 'q1 (Pop a on b)', x: 320, y: 180 },
      { id: 'p2', name: 'q2 (Accept)', x: 500, y: 180, isAccept: true },
    ],
    transitions: [
      {
        id: 'pt0',
        from: 'p0',
        to: 'p0',
        symbols: ['a'],
        pdaOps: [
          { input: 'a', pop: 'Z0', push: 'aZ0' },
          { input: 'a', pop: 'a', push: 'aa' },
        ],
      },
      {
        id: 'pt1',
        from: 'p0',
        to: 'p1',
        symbols: ['b'],
        pdaOps: [{ input: 'b', pop: 'a', push: 'ε' }],
      },
      {
        id: 'pt2',
        from: 'p1',
        to: 'p1',
        symbols: ['b'],
        pdaOps: [{ input: 'b', pop: 'a', push: 'ε' }],
      },
      {
        id: 'pt3',
        from: 'p1',
        to: 'p2',
        symbols: ['ε'],
        pdaOps: [{ input: 'ε', pop: 'Z0', push: 'Z0' }],
      },
    ],
    startStateId: 'p0',
    acceptStateIds: ['p2'],
  },
};

export const ConversionStudio: React.FC = () => {
  const [currentAutomaton, setCurrentAutomaton] = useState<AutomatonDefinition>(INITIAL_DFA);
  const [activeTab, setActiveTab] = useState<
    'simulate' | 'regex_to_nfa' | 'nfa_to_dfa' | 'minimize_dfa' | 'dfa_to_regex' | 'cyk_parser' | 'equivalence_check'
  >('simulate');

  // Simulation test input
  const [testInput, setTestInput] = useState('100101');
  const [simSteps, setSimSteps] = useState<SimulationStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Shared blank single-state starter, reused by every tab below that has
  // its own embedded canvas.
  const blankAutomaton = (): AutomatonDefinition => ({
    type: 'DFA',
    alphabet: ['0', '1'],
    states: [{ id: 'q0', name: 'q0', x: 120, y: 160, isStart: true }],
    transitions: [],
    startStateId: 'q0',
    acceptStateIds: [],
  });

  // Regex -> NFA
  const [regexInput, setRegexInput] = useState('(a|b)*abb');
  const [thompsonResult, setThompsonResult] = useState<ReturnType<typeof convertRegexToNFA> | null>(null);

  // NFA -> DFA — each tab now owns its own input automaton + canvas
  // directly, instead of depending on whatever's currently loaded in the
  // Simulate tab's shared tracer.
  const [nfaInput, setNfaInput] = useState<AutomatonDefinition>(blankAutomaton());
  const [nfaInputBuildRegex, setNfaInputBuildRegex] = useState('');
  const [subsetResult, setSubsetResult] = useState<ReturnType<typeof convertNFAToDFA> | null>(null);

  // DFA Minimization
  const [dfaMinInput, setDfaMinInput] = useState<AutomatonDefinition>(blankAutomaton());
  const [dfaMinInputBuildRegex, setDfaMinInputBuildRegex] = useState('');
  const [minResult, setMinResult] = useState<ReturnType<typeof minimizeDFA> | null>(null);

  // DFA -> Regex
  const [dfaToRegexInput, setDfaToRegexInput] = useState<AutomatonDefinition>(blankAutomaton());
  const [dfaToRegexInputBuildRegex, setDfaToRegexInputBuildRegex] = useState('');
  const [dfaToRegexResult, setDfaToRegexResult] = useState<ReturnType<typeof convertDFAToRegex> | null>(null);

  // CYK Parser
  const [cykGrammar, setCykGrammar] = useState<ContextFreeGrammar>({
    variables: ['S', 'A', 'B', 'C'],
    terminals: ['a', 'b'],
    startVariable: 'S',
    rules: [
      { left: 'S', right: ['AB', 'BC'] },
      { left: 'A', right: ['BA', 'a'] },
      { left: 'B', right: ['CC', 'b'] },
      { left: 'C', right: ['AB', 'a'] },
    ],
  });
  const [cykInput, setCykInput] = useState('baaba');
  const [cykResult, setCykResult] = useState<ReturnType<typeof parseCYKTable> | null>(null);

  // Standalone Equivalence Checker
  const [automatonA, setAutomatonA] = useState<AutomatonDefinition>(blankAutomaton());
  const [automatonB, setAutomatonB] = useState<AutomatonDefinition>(blankAutomaton());
  const [regexBuildA, setRegexBuildA] = useState('');
  const [regexBuildB, setRegexBuildB] = useState('');
  const [equivResult, setEquivResult] = useState<ReturnType<typeof checkAutomataEquivalence> | null>(null);
  const [equivTraceA, setEquivTraceA] = useState<SimulationStep[]>([]);
  const [equivTraceB, setEquivTraceB] = useState<SimulationStep[]>([]);

  // Run simulation
  const handleRunSim = () => {
    const steps = simulateAutomatonStepByStep(currentAutomaton, testInput);
    setSimSteps(steps);
    setCurrentStepIdx(0);
  };

  const activeStateIds = simSteps[currentStepIdx]?.currentStates || [];

  const handleCheckEquivalence = () => {
    const result = checkAutomataEquivalence(automatonA, automatonB);
    setEquivResult(result);
    if (!result.equivalent && result.counterexample !== null) {
      setEquivTraceA(simulateAutomatonStepByStep(automatonA, result.counterexample));
      setEquivTraceB(simulateAutomatonStepByStep(automatonB, result.counterexample));
    } else {
      setEquivTraceA([]);
      setEquivTraceB([]);
    }
  };

  // Batch tests
  const batchTestCases = [
    { input: '', expected: false },
    { input: '01', expected: true },
    { input: '1101', expected: true },
    { input: '0101', expected: true },
    { input: '100', expected: false },
    { input: '010', expected: false },
  ];
  const batchResults = runBatchTests(currentAutomaton, batchTestCases);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Header & Sub-Navigation */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">
                Automata & Grammar Conversions
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              State Machine & Language Transformation Studio
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Execute conversions between Regex, NFA, DFA, Minimal DFA, GNFA, and Chomsky CFGs.
            </p>
          </div>

          {/* Model presets */}
          <div className="flex items-center gap-2 self-start">
            <span className="text-xs text-slate-500">Load Preset:</span>
            <select
              onChange={(e) => {
                const model = PRESET_MODELS[e.target.value];
                if (model) {
                  setCurrentAutomaton(model);
                  setSimSteps([]);
                }
              }}
              className="bg-white border border-gray-300 text-xs text-slate-900 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono shadow-sm"
            >
              <option value="dfa_ends_01">DFA: Ends in 01</option>
              <option value="nfa_contains_010">NFA: Contains 010</option>
              <option value="pda_an_bn">PDA: aⁿ bⁿ (Stack)</option>
            </select>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="flex items-center gap-1.5 pt-4 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'simulate', label: 'Interactive Canvas & Tracer', icon: Play },
            { id: 'regex_to_nfa', label: 'Regex → NFA (Thompson)', icon: Zap },
            { id: 'nfa_to_dfa', label: 'NFA → DFA (Subset Construction)', icon: Layers },
            { id: 'minimize_dfa', label: 'DFA Minimization (Table-Filling)', icon: Minimize2 },
            { id: 'dfa_to_regex', label: 'DFA → Regex (State Elimination)', icon: FileCode },
            { id: 'cyk_parser', label: 'CFG → CYK Parsing Table', icon: Table },
            { id: 'equivalence_check', label: 'Equivalence Checker', icon: GitCompareArrows },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                  isSel
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                    : 'bg-white border-gray-200 text-slate-600 hover:text-slate-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Interactive Canvas & Step-by-Step Tracer */}
      {activeTab === 'simulate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Visual Canvas */}
          <div className="lg:col-span-8 space-y-4">
            <AutomataCanvas
              automaton={currentAutomaton}
              onChange={setCurrentAutomaton}
              activeStateIds={activeStateIds}
            />

            {/* Live Step Controls */}
            {simSteps.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentStepIdx((i) => Math.max(0, i - 1))}
                    disabled={currentStepIdx === 0}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-xs font-semibold text-slate-700 transition"
                  >
                    ← Step Back
                  </button>
                  <span className="text-xs font-mono text-indigo-600 font-bold">
                    Step {currentStepIdx} of {simSteps.length - 1}
                  </span>
                  <button
                    onClick={() => setCurrentStepIdx((i) => Math.min(simSteps.length - 1, i + 1))}
                    disabled={currentStepIdx === simSteps.length - 1}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-xs font-semibold text-white shadow-sm transition"
                  >
                    Step Forward →
                  </button>
                </div>

                <div className="text-xs text-slate-700 font-mono">
                  {simSteps[currentStepIdx]?.message}
                </div>
              </div>
            )}
          </div>

          {/* Right: Input Tracer & Batch Testing */}
          <div className="lg:col-span-4 space-y-5">
            {/* Single String Execution */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Execution Tracer
              </h3>

              <div className="space-y-2">
                <label className="text-xs text-slate-500">Test Input String (w):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="e.g. 0101"
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleRunSim}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Simulate
                  </button>
                </div>
              </div>

              {/* Status Verdict */}
              {simSteps.length > 0 && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    simSteps[simSteps.length - 1]?.isAccepted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {simSteps[simSteps.length - 1]?.isAccepted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {simSteps[simSteps.length - 1]?.isAccepted ? 'ACCEPTED' : 'REJECTED'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono opacity-80">
                    {simSteps.length - 1} transitions
                  </span>
                </div>
              )}

              {/* Tape or Stack View for PDA/TM */}
              {currentAutomaton.type === 'PDA' && simSteps[currentStepIdx]?.stack && (
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1.5">
                  <div className="text-xs text-slate-500 font-semibold">PDA Stack (Top → Bottom):</div>
                  <div className="flex items-center gap-1 font-mono text-xs text-indigo-700">
                    {simSteps[currentStepIdx].stack?.map((item, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Batch Test Vectors */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Batch Test Vectors
              </h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {batchResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-gray-200 text-xs"
                  >
                    <span className="font-mono text-slate-800">
                      "{res.input || 'ε'}"
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          res.actual
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-slate-600'
                        }`}
                      >
                        {res.actual ? 'Accept' : 'Reject'}
                      </span>
                      {res.passed ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Regex -> NFA (Thompson's Construction) */}
      {activeTab === 'regex_to_nfa' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Thompson's Construction Algorithm (Regex → ε-NFA)
                </h3>
                <p className="text-xs text-slate-500">
                  Supports concatenation `ab`, union `a|b`, Kleene star `a*`, and grouping `(a|b)*`.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {['(a|b)*abb', '01*|10*', '(0|1)*001', 'a*b*c*'].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setRegexInput(ex);
                      const res = convertRegexToNFA(ex);
                      setThompsonResult(res);
                    }}
                    className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-50 hover:bg-gray-100 border border-gray-200 text-indigo-600 transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={regexInput}
                onChange={(e) => setRegexInput(e.target.value)}
                placeholder="(a|b)*abb"
                className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => {
                  const res = convertRegexToNFA(regexInput);
                  setThompsonResult(res);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
              >
                <Zap className="w-4 h-4" />
                Generate ε-NFA
              </button>
            </div>
          </div>

          {thompsonResult && (
            <div className="space-y-6">
              {/* Conversion Statistics */}
              <StatsGrid
                stats={[
                  { label: 'Input Regex Length', value: regexInput.length },
                  { label: 'NFA States', value: thompsonResult.nfa.states.length },
                  { label: 'NFA Transitions', value: thompsonResult.nfa.transitions.length },
                  { label: 'Accepting States', value: thompsonResult.nfa.acceptStateIds.length },
                  { label: 'Alphabet Size', value: thompsonResult.nfa.alphabet.length },
                  { label: 'Construction Steps', value: thompsonResult.steps.length },
                  { label: 'Method', value: "Thompson's Construction" },
                ]}
              />

              {/* Step-by-Step Explanation */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Step-by-Step Construction Walkthrough
                </h4>
                <div className="space-y-2">
                  {thompsonResult.steps.map((st) => (
                    <div key={st.step} className="p-3 bg-slate-50 rounded-xl border border-gray-200 text-xs">
                      <div className="font-semibold text-amber-700 mb-1">
                        Step {st.step}: built '{st.resultLabel}' ({st.stateCount} states, {st.transitionCount} transitions)
                      </div>
                      <div className="text-slate-700 leading-relaxed">{st.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Generated Thompson NFA ({thompsonResult.nfa.states.length} states, {thompsonResult.nfa.transitions.length} transitions)
                  </span>
                  <button
                    onClick={() => {
                      setCurrentAutomaton(thompsonResult.nfa);
                      setActiveTab('simulate');
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                  >
                    Load in Interactive Tracer →
                  </button>
                </div>
                <AutomataCanvas
                  automaton={thompsonResult.nfa}
                  onChange={(nfa) => setThompsonResult({ ...thompsonResult, nfa })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: NFA -> DFA (Subset Construction) */}
      {activeTab === 'nfa_to_dfa' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Subset / Powerset Construction (NFA → DFA)
              </h3>
              <p className="text-xs text-slate-500">
                Build or load an NFA below, then convert it into an equivalent DFA.
              </p>
            </div>
            <InputBuilderRow
              regexValue={nfaInputBuildRegex}
              onRegexChange={setNfaInputBuildRegex}
              onBuild={() => {
                if (nfaInputBuildRegex.trim()) setNfaInput(convertRegexToNFA(nfaInputBuildRegex).nfa);
              }}
              onPreset={(model) => setNfaInput(model)}
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Your NFA (editable)
            </span>
            <AutomataCanvas automaton={nfaInput} onChange={setNfaInput} />
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                const res = convertNFAToDFA(nfaInput);
                setSubsetResult(res);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition"
            >
              <Layers className="w-4 h-4" />
              Run Subset Construction
            </button>
          </div>

          {subsetResult && (
            <div className="space-y-6">
              {/* Conversion Statistics */}
              <StatsGrid
                stats={[
                  { label: 'Original NFA States', value: nfaInput.states.length },
                  { label: 'Resulting DFA States', value: subsetResult.dfa.states.length },
                  { label: 'DFA Transitions', value: subsetResult.dfa.transitions.length },
                  { label: 'Accepting States', value: subsetResult.dfa.acceptStateIds.length },
                  {
                    label: 'Max Possible Subsets (2ⁿ)',
                    value: `${Math.pow(2, nfaInput.states.length)} (only ${subsetResult.dfa.states.length} reachable)`,
                  },
                  { label: 'Method', value: 'Subset / Powerset Construction' },
                ]}
              />

              {/* Original vs Converted Verification */}
              <VerificationPanel
                original={nfaInput}
                converted={subsetResult.dfa}
                originalLabel="Original NFA"
                convertedLabel="Converted DFA"
              />

              {/* Transition Table */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  DFA Powerset Transition Table & ε-Closures
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-gray-200 text-slate-600 bg-gray-50">
                        <th className="p-3 font-semibold">DFA State</th>
                        <th className="p-3 font-semibold">NFA Subset Closure</th>
                        {nfaInput.alphabet.map((sym) => (
                          <th key={sym} className="p-3 font-semibold">
                            Input '{sym}'
                          </th>
                        ))}
                        <th className="p-3 font-semibold">Accepting?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-slate-800">
                      {subsetResult.steps.map((st) => (
                        <tr key={st.dfaStateName} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-indigo-600">{st.dfaStateName}</td>
                          <td className="p-3 text-slate-600">
                            &#123;{st.nfaStateSet.join(', ') || '∅'}&#125;
                          </td>
                          {nfaInput.alphabet.map((sym) => {
                            const target = st.transitions[sym];
                            return (
                              <td key={sym} className="p-3">
                                {target ? (
                                  <span className="font-bold text-slate-900">
                                    {target.targetDfaState}{' '}
                                    <span className="text-[10px] text-slate-500">
                                      (&#123;{target.targetNfaSet.join(',')}&#125;)
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">∅</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-3">
                            {st.isAccept ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                YES ✓
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Step-by-Step Construction Walkthrough */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Step-by-Step Construction Walkthrough
                </h4>

                <div className="space-y-2">
                  {subsetResult.steps.map((st) => (
                    <div
                      key={st.step}
                      className="p-3 bg-slate-50 rounded-xl border border-gray-200 text-xs"
                    >
                      <div className="font-semibold text-amber-700 mb-1">
                        Step {st.step}: DFA state {st.dfaStateName}
                      </div>

                      <div className="text-slate-700 leading-relaxed">
                        {st.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Render generated DFA */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-700">
                    Constructed Deterministic Finite Automaton (DFA)
                  </h4>
                  <button
                    onClick={() => {
                      setCurrentAutomaton(subsetResult.dfa);
                      setActiveTab('simulate');
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                  >
                    Load in Tracer →
                  </button>
                </div>
                <AutomataCanvas
                  automaton={subsetResult.dfa}
                  onChange={(dfa) => setSubsetResult({ ...subsetResult, dfa })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: DFA Minimization (Table Filling) */}
      {activeTab === 'minimize_dfa' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                DFA Minimization (Hopcroft / Myhill-Nerode Table-Filling)
              </h3>
              <p className="text-xs text-slate-500">
                Build or load a DFA below, then find its minimal equivalent.
              </p>
            </div>
            <InputBuilderRow
              regexValue={dfaMinInputBuildRegex}
              onRegexChange={setDfaMinInputBuildRegex}
              onBuild={() => {
                if (dfaMinInputBuildRegex.trim()) {
                  const { nfa } = convertRegexToNFA(dfaMinInputBuildRegex);
                  const { dfa } = convertNFAToDFA(nfa);
                  setDfaMinInput(dfa);
                }
              }}
              onPreset={(model) => setDfaMinInput(model)}
              placeholder="Build a (non-minimal) DFA from a regex, e.g. (a|b)*abb"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Your DFA (editable)
            </span>
            <AutomataCanvas automaton={dfaMinInput} onChange={setDfaMinInput} />
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                const res = minimizeDFA(dfaMinInput);
                setMinResult(res);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition"
            >
              <Minimize2 className="w-4 h-4" />
              Minimize This DFA
            </button>
          </div>

          {minResult && (
            <div className="space-y-6">
              {/* Conversion Statistics */}
              <StatsGrid
                stats={[
                  { label: 'Original DFA States', value: dfaMinInput.states.length },
                  { label: 'Minimized DFA States', value: minResult.minimizedDfa.states.length },
                  { label: 'States Removed', value: dfaMinInput.states.length - minResult.minimizedDfa.states.length },
                  {
                    label: 'Reduction',
                    value:
                      dfaMinInput.states.length > 0
                        ? `${Math.round(
                            (1 - minResult.minimizedDfa.states.length / dfaMinInput.states.length) * 100
                          )}%`
                        : '0%',
                  },
                  { label: 'Accepting States', value: minResult.minimizedDfa.acceptStateIds.length },
                  { label: 'Method', value: 'Table-Filling (Myhill-Nerode)' },
                ]}
              />

              {/* Original vs Converted Verification */}
              <VerificationPanel
                original={dfaMinInput}
                converted={minResult.minimizedDfa}
                originalLabel="Original DFA"
                convertedLabel="Minimized DFA"
              />

              {/* Minimization steps */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Minimization Equivalence Classes
                </h4>
                <div className="space-y-2 text-xs text-slate-700">
                  {minResult.steps.map((st, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                      <div className="font-semibold text-indigo-600 mb-1">{st.notes}</div>
                      {st.partitions.length > 0 && (
                        <div className="font-mono text-slate-700">
                          Partitions: {st.partitions.map((p) => `{${p.join(', ')}}`).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Render Minimized DFA */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-700">
                    Minimal DFA ({minResult.minimizedDfa.states.length} states)
                  </h4>
                  <button
                    onClick={() => {
                      setCurrentAutomaton(minResult.minimizedDfa);
                      setActiveTab('simulate');
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                  >
                    Load Minimal DFA in Tracer →
                  </button>
                </div>
                <AutomataCanvas
                  automaton={minResult.minimizedDfa}
                  onChange={(dfa) => setMinResult({ ...minResult, minimizedDfa: dfa })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: DFA -> Regex (State Elimination) */}
      {activeTab === 'dfa_to_regex' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                DFA to Regular Expression (State Elimination Algorithm)
              </h3>
              <p className="text-xs text-slate-500">
                Build or load a DFA below, then extract a regular expression describing its language.
              </p>
            </div>
            <InputBuilderRow
              regexValue={dfaToRegexInputBuildRegex}
              onRegexChange={setDfaToRegexInputBuildRegex}
              onBuild={() => {
                if (dfaToRegexInputBuildRegex.trim()) {
                  const { nfa } = convertRegexToNFA(dfaToRegexInputBuildRegex);
                  const { dfa } = convertNFAToDFA(nfa);
                  const { minimizedDfa } = minimizeDFA(dfa);
                  setDfaToRegexInput(minimizedDfa);
                }
              }}
              onPreset={(model) => setDfaToRegexInput(model)}
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Your DFA (editable)
            </span>
            <AutomataCanvas automaton={dfaToRegexInput} onChange={setDfaToRegexInput} />
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                const res = convertDFAToRegex(dfaToRegexInput);
                setDfaToRegexResult(res);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition"
            >
              <FileCode className="w-4 h-4" />
              Convert to Regex
            </button>
          </div>

          {dfaToRegexResult && (
            <div className="space-y-5">
              {/* Conversion Statistics */}
              <StatsGrid
                stats={[
                  { label: 'Original DFA States', value: dfaToRegexInput.states.length },
                  { label: 'Resulting Regex Length', value: dfaToRegexResult.regex.length },
                  { label: 'Elimination Steps', value: dfaToRegexResult.steps.length },
                  { label: 'Method', value: 'State Elimination (GNFA)' },
                ]}
              />

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Final Derived Regular Expression:
                </h4>
                <div className="p-4 bg-slate-50 rounded-xl border border-indigo-200 font-mono text-base text-indigo-700 font-bold break-all">
                  {dfaToRegexResult.regex}
                </div>
              </div>

              {/* Original vs Converted Verification (round-trip: re-parse the derived regex) */}
              {dfaToRegexResult.regex !== '∅' ? (
                <VerificationPanel
                  original={dfaToRegexInput}
                  converted={convertRegexToNFA(dfaToRegexResult.regex).nfa}
                  originalLabel="Original DFA"
                  convertedLabel="Regex (re-parsed)"
                />
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-xs text-slate-500">
                  The derived regex is ∅ (empty language) — skipping round-trip verification since '∅' isn't a
                  parseable token in this tool's regex syntax.
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  State Elimination Step-by-Step History
                </h4>
                <div className="space-y-2">
                  {dfaToRegexResult.steps.map((st) => (
                    <div key={st.step} className="p-3 bg-slate-50 rounded-xl border border-gray-200 text-xs">
                      <div className="font-semibold text-amber-700 mb-1">
                        Step {st.step}: {st.eliminatedState}
                      </div>
                      <div className="text-slate-700 leading-relaxed">{st.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: CFG -> CYK Parser */}
      {activeTab === 'cyk_parser' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                CYK Dynamic Programming Algorithm (Cocke-Younger-Kasami)
              </h3>
              <p className="text-xs text-slate-500">
                Tests Context-Free Grammar membership in Chomsky Normal Form (CNF: A → BC or A → a).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">CNF Grammar Rules:</label>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 font-mono text-xs text-slate-800 space-y-1">
                  {cykGrammar.rules.map((r, idx) => (
                    <div key={idx}>
                      <span className="text-indigo-600 font-bold">{r.left}</span> → {r.right.join(' | ')}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-500">Test Input String:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cykInput}
                    onChange={(e) => setCykInput(e.target.value)}
                    placeholder="e.g. baaba"
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      const res = parseCYKTable(cykGrammar, cykInput);
                      setCykResult(res);
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
                  >
                    Run CYK
                  </button>
                </div>
              </div>
            </div>
          </div>

          {cykResult && (
            <div className="space-y-6">
              {/* Step-by-Step Explanation */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Step-by-Step Derivation Walkthrough
                </h4>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {cykResult.steps.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 rounded-lg border border-gray-200 text-xs font-mono text-slate-700"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    CYK Triangular Dynamic Programming Table
                  </h4>
                  <div
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      cykResult.accepted
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {cykResult.accepted ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {cykResult.accepted ? 'Accepted by Grammar (S ∈ Top Cell)' : 'Rejected by Grammar'}
                  </div>
                </div>

                {/* Triangular table display */}
                <div className="space-y-2 font-mono text-xs">
                  {cykResult.table.map((row, lIdx) => (
                    <div key={lIdx} className="flex items-center gap-2">
                      <span className="w-16 text-slate-500 text-[11px]">Len {lIdx + 1}:</span>
                      <div className="flex items-center gap-2">
                        {row.map((cell, sIdx) => (
                          <div
                            key={sIdx}
                            className={`px-3 py-1.5 rounded-lg border text-center min-w-[70px] ${
                              cell.includes('S')
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold shadow-sm'
                                : cell.length > 0
                                ? 'bg-white border-gray-300 text-slate-800'
                                : 'bg-slate-50 border-gray-200 text-slate-400'
                            }`}
                          >
                            &#123;{cell.join(',') || '∅'}&#125;
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Standalone Equivalence Checker */}
      {activeTab === 'equivalence_check' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Automata Equivalence Checker</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Build or load any two automata below and check whether they accept exactly the same language. If not,
              get the shortest input where they disagree, traced through both.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Automaton A */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Automaton A</span>
                <select
                  onChange={(e) => {
                    const model = PRESET_MODELS[e.target.value];
                    if (model) setAutomatonA(JSON.parse(JSON.stringify(model)));
                  }}
                  className="bg-white border border-gray-300 text-[11px] text-slate-900 rounded-lg px-2 py-1 focus:border-indigo-500 focus:outline-none font-mono"
                >
                  <option value="">Load preset…</option>
                  <option value="dfa_ends_01">DFA: Ends in 01</option>
                  <option value="nfa_contains_010">NFA: Contains 010</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={regexBuildA}
                  onChange={(e) => setRegexBuildA(e.target.value)}
                  placeholder="Or build from regex, e.g. (a|b)*abb"
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => {
                    if (regexBuildA.trim()) setAutomatonA(convertRegexToNFA(regexBuildA).nfa);
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Build
                </button>
              </div>
              <AutomataCanvas automaton={automatonA} onChange={setAutomatonA} />
            </div>

            {/* Automaton B */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Automaton B</span>
                <select
                  onChange={(e) => {
                    const model = PRESET_MODELS[e.target.value];
                    if (model) setAutomatonB(JSON.parse(JSON.stringify(model)));
                  }}
                  className="bg-white border border-gray-300 text-[11px] text-slate-900 rounded-lg px-2 py-1 focus:border-indigo-500 focus:outline-none font-mono"
                >
                  <option value="">Load preset…</option>
                  <option value="dfa_ends_01">DFA: Ends in 01</option>
                  <option value="nfa_contains_010">NFA: Contains 010</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={regexBuildB}
                  onChange={(e) => setRegexBuildB(e.target.value)}
                  placeholder="Or build from regex, e.g. (a|b)*abb"
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => {
                    if (regexBuildB.trim()) setAutomatonB(convertRegexToNFA(regexBuildB).nfa);
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Build
                </button>
              </div>
              <AutomataCanvas automaton={automatonB} onChange={setAutomatonB} />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleCheckEquivalence}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition"
            >
              <Scale className="w-4 h-4" />
              Check Equivalence
            </button>
          </div>

          {equivResult && (
            <div
              className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 ${
                equivResult.equivalent ? 'border-emerald-200' : 'border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {equivResult.equivalent ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <h4
                  className={`text-sm font-bold ${equivResult.equivalent ? 'text-emerald-700' : 'text-rose-700'}`}
                >
                  {equivResult.equivalent ? 'Equivalent — same language' : 'Not Equivalent'}
                </h4>
              </div>

              {!equivResult.equivalent && equivResult.counterexample !== null && (
                <>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    Shortest distinguishing input:{' '}
                    <span className="font-mono font-bold">"{equivResult.counterexample || 'ε'}"</span> — Automaton A
                    says <strong>{equivResult.acceptedByA ? 'ACCEPT' : 'REJECT'}</strong>, Automaton B says{' '}
                    <strong>{equivResult.acceptedByB ? 'ACCEPT' : 'REJECT'}</strong>.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Trace through Automaton A:
                      </div>
                      {equivTraceA.map((st, idx) => (
                        <div key={idx} className="text-xs font-mono text-slate-700">
                          {st.message}
                        </div>
                      ))}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Trace through Automaton B:
                      </div>
                      {equivTraceB.map((st, idx) => (
                        <div key={idx} className="text-xs font-mono text-slate-700">
                          {st.message}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};