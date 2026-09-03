export type AutomatonType = 'DFA' | 'NFA' | 'ENFA' | 'PDA' | 'TM';

export interface StateNode {
  id: string;
  name: string;
  x: number;
  y: number;
  isStart?: boolean;
  isAccept?: boolean;
}

export interface TransitionEdge {
  id: string;
  from: string;
  to: string;
  symbols: string[]; // for DFA/NFA: symbols like '0', '1', 'ε' / 'eps'
  // for PDA: 'symbol,pop->push' e.g. '0, Z0 -> 0Z0' or '1, 0 -> ε'
  pdaOps?: Array<{ input: string; pop: string; push: string }>;
  // for TM: 'read->write,dir' e.g. '0 -> 1, R' or 'B -> B, L'
  tmOps?: Array<{ read: string; write: string; dir: 'L' | 'R' | 'S' }>;
}

export interface AutomatonDefinition {
  type: AutomatonType;
  alphabet: string[];
  states: StateNode[];
  transitions: TransitionEdge[];
  startStateId: string;
  acceptStateIds: string[];
  // PDA specific
  stackAlphabet?: string[];
  initialStackSymbol?: string;
  // TM specific
  tapeAlphabet?: string[];
  blankSymbol?: string;
}

export interface SimulationStep {
  stepIndex: number;
  currentStates: string[]; // State IDs
  remainingInput: string;
  consumedInput: string;
  // PDA specific
  stack?: string[];
  // TM specific
  tape?: string[];
  headPosition?: number;
  message?: string;
  isAccepted?: boolean;
  isDeadEnd?: boolean;
}

export interface BatchTestResult {
  input: string;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  stepsCount: number;
  trace: string[];
}

export interface ThompsonConstructionStep {
  step: number;
  token: string;
  operation: 'symbol' | 'concat' | 'union' | 'star';
  resultLabel: string;
  stateCount: number;
  transitionCount: number;
  explanation: string;
}

export interface SubsetConstructionStep {
  step: number;
  dfaStateName: string;
  explanation: string;
  nfaStateSet: string[]; // state names
  transitions: Record<string, { targetDfaState: string; targetNfaSet: string[] }>;
  isAccept: boolean;
  isNew: boolean;
}

export interface MinimizationStep {
  round: number;
  partitions: string[][]; // groups of state names
  distinguishableTable: Record<string, Record<string, boolean>>;
  notes: string;
}

export interface StateEliminationStep {
  step: number;
  eliminatedState: string;
  remainingStates: string[];
  transitionsRegex: Record<string, Record<string, string>>;
  explanation: string;
}

export interface CFGRule {
  left: string; // e.g. 'S'
  right: string[]; // e.g. ['AB', 'a']
}

export interface ContextFreeGrammar {
  variables: string[];
  terminals: string[];
  startVariable: string;
  rules: CFGRule[];
}

export interface PumpingLemmaLanguage {
  id: string;
  name: string;
  type: 'regular' | 'context-free';
  formulaLatex: string;
  description: string;
  alphabet: string[];
  adversaryPStrategy: (p: number) => { minP: number; recommendedP: number };
  sampleStrings: (p: number) => Array<{ label: string; value: string; isOptimal: boolean; hint: string }>;
  validSplits: (w: string, p: number) => Array<{ x: string; y: string; z: string; u?: string; v?: string; w_mid?: string }>;
  testPump: (split: { x: string; y: string; z: string; u?: string; v?: string; w_mid?: string }, i: number) => {
    pumpedString: string;
    inLanguage: boolean;
    reason: string;
  };
  formalProof: {
    theorem: string;
    choiceOfW: string;
    adversarySplits: string;
    contradictionCase: string;
    conclusion: string;
  };
}

export interface PracticeProblem {
  id: string;
  title: string;
  category: 'dfa_design' | 'nfa_design' | 'regex' | 'pumping_lemma' | 'conversion' | 'pda_tm';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  formalLanguageSpec: string;
  alphabet: string[];
  testCases: Array<{ input: string; expected: boolean; description?: string }>;
  starterAutomaton?: AutomatonDefinition;
  starterRegex?: string;
  hints: string[];
  solutionExplanation: string;
  referenceSolution?: AutomatonDefinition;
}
