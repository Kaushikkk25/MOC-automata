import React, { useState } from 'react';
import { AutomatonDefinition, ContextFreeGrammar, SimulationStep } from '../../types/automata';
import {
  convertDFAToRegex,
  convertNFAToDFA,
  convertRegexToNFA,
  getStateName,
  minimizeDFA,
  parseCYKTable,
  runBatchTests,
  simulateAutomatonStepByStep,
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
  Network
} from 'lucide-react';

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
    'simulate' | 'regex_to_nfa' | 'nfa_to_dfa' | 'minimize_dfa' | 'dfa_to_regex' | 'cyk_parser'
  >('simulate');

  // Simulation test input
  const [testInput, setTestInput] = useState('100101');
  const [simSteps, setSimSteps] = useState<SimulationStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Regex -> NFA
  const [regexInput, setRegexInput] = useState('(a|b)*abb');
  const [generatedNfa, setGeneratedNfa] = useState<AutomatonDefinition | null>(null);

  // NFA -> DFA
  const [subsetResult, setSubsetResult] = useState<ReturnType<typeof convertNFAToDFA> | null>(null);

  // DFA Minimization
  const [minResult, setMinResult] = useState<ReturnType<typeof minimizeDFA> | null>(null);

  // DFA -> Regex
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

  // Run simulation
  const handleRunSim = () => {
    const steps = simulateAutomatonStepByStep(currentAutomaton, testInput);
    setSimSteps(steps);
    setCurrentStepIdx(0);
  };

  const activeStateIds = simSteps[currentStepIdx]?.currentStates || [];

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
                      const nfa = convertRegexToNFA(ex);
                      setGeneratedNfa(nfa);
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
                  const nfa = convertRegexToNFA(regexInput);
                  setGeneratedNfa(nfa);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
              >
                <Zap className="w-4 h-4" />
                Generate ε-NFA
              </button>
            </div>
          </div>

          {generatedNfa && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Generated Thompson NFA ({generatedNfa.states.length} states, {generatedNfa.transitions.length} transitions)
                </span>
                <button
                  onClick={() => {
                    setCurrentAutomaton(generatedNfa);
                    setActiveTab('simulate');
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                >
                  Load in Interactive Tracer →
                </button>
              </div>
              <AutomataCanvas automaton={generatedNfa} onChange={setGeneratedNfa} />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: NFA -> DFA (Subset Construction) */}
      {activeTab === 'nfa_to_dfa' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Subset / Powerset Construction (NFA → DFA)
              </h3>
              <p className="text-xs text-slate-500">
                Computes ε-closures and power set state table for the active automaton.
              </p>
            </div>
            <button
              onClick={() => {
                const res = convertNFAToDFA(currentAutomaton);
                setSubsetResult(res);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Layers className="w-4 h-4" />
              Run Subset Construction
            </button>
          </div>

          {subsetResult && (
            <div className="space-y-6">
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
                        {currentAutomaton.alphabet.map((sym) => (
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
                          {currentAutomaton.alphabet.map((sym) => {
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
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                DFA Minimization (Hopcroft / Myhill-Nerode Table-Filling)
              </h3>
              <p className="text-xs text-slate-500">
                Calculates distinguishable state pairs and produces minimal equivalent DFA.
              </p>
            </div>
            <button
              onClick={() => {
                const res = minimizeDFA(currentAutomaton);
                setMinResult(res);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Minimize2 className="w-4 h-4" />
              Minimize Current DFA
            </button>
          </div>

          {minResult && (
            <div className="space-y-6">
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
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                DFA to Regular Expression (State Elimination Algorithm)
              </h3>
              <p className="text-xs text-slate-500">
                Transforms DFA into GNFA and eliminates states to extract regular expression.
              </p>
            </div>
            <button
              onClick={() => {
                const res = convertDFAToRegex(currentAutomaton);
                setDfaToRegexResult(res);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
            >
              <FileCode className="w-4 h-4" />
              Convert to Regex
            </button>
          </div>

          {dfaToRegexResult && (
            <div className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Final Derived Regular Expression:
                </h4>
                <div className="p-4 bg-slate-50 rounded-xl border border-indigo-200 font-mono text-base text-indigo-700 font-bold break-all">
                  {dfaToRegexResult.regex}
                </div>
              </div>

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
          )}
        </div>
      )}
    </div>
  );
};
