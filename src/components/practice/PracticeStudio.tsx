import React, { useState } from 'react';
import { PRACTICE_PROBLEMS } from '../../data/practiceProblems';
import {
  AutomatonDefinition,
  MinimizationStep,
  PracticeProblem,
  SimulationStep,
  StateEliminationStep,
  SubsetConstructionStep,
  ThompsonConstructionStep,
} from '../../types/automata';
import {
  checkAutomataEquivalence,
  convertDFAToRegex,
  convertNFAToDFA,
  convertRegexToNFA,
  isEpsilon,
  minimizeDFA,
  runBatchTests,
  simulateAutomatonStepByStep,
  testAutomatonInput,
} from '../../utils/automataEngine';
import { AutomataCanvas } from '../canvas/AutomataCanvas';
import confetti from 'canvas-confetti';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Play,
  RotateCcw,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  PlusCircle
} from 'lucide-react';

type ConversionKind = 'design' | 'regex_to_nfa' | 'nfa_to_dfa' | 'dfa_minimize' | 'dfa_to_regex';

interface CustomProblemMeta {
  kind: ConversionKind;
  givenAutomaton?: AutomatonDefinition;
  answerFormat: 'automaton' | 'regex';
  requireDeterministic?: boolean;
  minimalStateCount?: number;
}

interface CustomDerivation {
  thompsonSteps?: ThompsonConstructionStep[];
  subsetSteps?: SubsetConstructionStep[];
  minimizationSteps?: MinimizationStep[];
  eliminationSteps?: StateEliminationStep[];
  answerRegex?: string; // only set for dfa_to_regex — kept out of the visible problem text, revealed only in Worked Solution
}

// Enumerate short strings over the DFA's alphabet and pick a representative,
// mostly-short sample of accepted/rejected ones as test cases — grounded in
// the actual computed reference DFA, not invented.
function generateTestCasesFromDFA(
  dfa: AutomatonDefinition
): Array<{ input: string; expected: boolean; description?: string }> {
  const alphabet = dfa.alphabet;
  if (alphabet.length === 0) {
    return [{ input: '', expected: testAutomatonInput(dfa, ''), description: 'Empty string ε' }];
  }

  // Smaller max length for bigger alphabets to keep the enumeration sane.
  const maxLen = alphabet.length <= 2 ? 6 : alphabet.length === 3 ? 4 : 3;

  const candidates: string[] = [''];
  let frontier = [''];
  for (let len = 1; len <= maxLen; len++) {
    const next: string[] = [];
    for (const s of frontier) {
      for (const sym of alphabet) next.push(s + sym);
    }
    candidates.push(...next);
    frontier = next;
  }

  const accepted = candidates.filter((s) => testAutomatonInput(dfa, s));
  const rejected = candidates.filter((s) => !testAutomatonInput(dfa, s));

  const picked: string[] = [];
  let i = 0;
  let j = 0;
  while (picked.length < 10 && (i < accepted.length || j < rejected.length)) {
    if (i < accepted.length) picked.push(accepted[i++]);
    if (picked.length < 10 && j < rejected.length) picked.push(rejected[j++]);
  }

  return picked
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .map((s) => ({
      input: s,
      expected: testAutomatonInput(dfa, s),
      description: s === '' ? 'Empty string ε' : undefined,
    }));
}

// Derive 4 progressive hints from real structural facts about a reference
// automaton — vaguest/most general first, most concrete last. targetLabel
// and fallbackHint are supplied by the caller so this never assumes what's
// safe to reveal (e.g. a DFA-to-Regex problem must never print the answer
// regex here).
function generateHintsFromDFA(automaton: AutomatonDefinition, targetLabel: string, fallbackHint: string): string[] {
  const n = automaton.states.length;
  const acceptCount = automaton.acceptStateIds.length;
  const startAccepts = automaton.acceptStateIds.includes(automaton.startStateId);
  const firstSym = automaton.alphabet[0];

  let firstSymHint = '';
  if (firstSym) {
    const t = automaton.transitions.find(
      (tr) => tr.from === automaton.startStateId && tr.symbols.includes(firstSym)
    );
    if (t) {
      const targetAccepts = automaton.acceptStateIds.includes(t.to);
      firstSymHint = `From the start state, reading '${firstSym}' should lead to a state that is ${
        targetAccepts ? '' : 'NOT '
      }accepting.`;
    }
  }

  return [
    `${targetLabel} needs exactly ${n} state${n === 1 ? '' : 's'}.`,
    `The empty string ε ${startAccepts ? 'IS' : 'is NOT'} in this language, so the start state ${
      startAccepts ? 'must be accepting' : 'must NOT be accepting'
    }.`,
    `There ${acceptCount === 1 ? 'is exactly 1 accepting state' : `are exactly ${acceptCount} accepting states`}.`,
    firstSymHint || fallbackHint,
  ];
}

// A valid DFA answer must have at most one transition per symbol per state,
// and no ε-transitions (those are only meaningful for NFA/ENFA).
function isAutomatonDeterministic(a: AutomatonDefinition): boolean {
  for (const t of a.transitions) {
    if (t.symbols.some((s) => isEpsilon(s))) return false;
  }
  const usedSymbolsPerState = new Map<string, Set<string>>();
  for (const t of a.transitions) {
    if (!usedSymbolsPerState.has(t.from)) usedSymbolsPerState.set(t.from, new Set());
    const used = usedSymbolsPerState.get(t.from)!;
    for (const sym of t.symbols) {
      if (used.has(sym)) return false;
      used.add(sym);
    }
  }
  return true;
}

// Count states actually reachable from the start state — used to check
// whether a "minimize this DFA" answer really is minimal, not just correct.
function countReachableStates(a: AutomatonDefinition): number {
  const reachable = new Set<string>([a.startStateId]);
  const queue = [a.startStateId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const t of a.transitions) {
      if (t.from === cur && !reachable.has(t.to)) {
        reachable.add(t.to);
        queue.push(t.to);
      }
    }
  }
  return reachable.size;
}

export const PracticeStudio: React.FC = () => {
  const [selectedProblemId, setSelectedProblemId] = useState<string>(PRACTICE_PROBLEMS[0].id);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  // User-added custom questions (regex -> auto-solved problem), this session
  const [customProblems, setCustomProblems] = useState<PracticeProblem[]>([]);
  const [customDerivations, setCustomDerivations] = useState<Record<string, CustomDerivation>>({});
  const [customProblemMeta, setCustomProblemMeta] = useState<Record<string, CustomProblemMeta>>({});

  // "Add Your Own Question" form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRegex, setNewRegex] = useState('');
  const [newDifficulty, setNewDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [newKind, setNewKind] = useState<ConversionKind>('design');
  const [addFormError, setAddFormError] = useState<string | null>(null);

  const allProblems = [...PRACTICE_PROBLEMS, ...customProblems];

  const selectedProblem = allProblems.find((p) => p.id === selectedProblemId) || allProblems[0];
  const selectedDerivation = customDerivations[selectedProblem.id];
  const selectedMeta = customProblemMeta[selectedProblem.id];

  // User's working automaton for this problem
  const [userAutomaton, setUserAutomaton] = useState<AutomatonDefinition>(
    selectedProblem.starterAutomaton || {
      type: 'DFA',
      alphabet: selectedProblem.alphabet,
      states: [{ id: 'q0', name: 'q0', x: 120, y: 160, isStart: true }],
      transitions: [],
      startStateId: 'q0',
      acceptStateIds: [],
    }
  );

  // Test Results
  const [testResults, setTestResults] = useState<ReturnType<typeof runBatchTests>>([]);
  const [hasRunTests, setHasRunTests] = useState<boolean>(false);
  const [solvedProblemIds, setSolvedProblemIds] = useState<Set<string>>(new Set());

  // Hints
  const [revealedHintIdx, setRevealedHintIdx] = useState<number>(-1);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [showWorkedSolution, setShowWorkedSolution] = useState<boolean>(false);

  // Mistake diagnosis (only available for problems with a referenceSolution)
  const [mistakeDiagnosis, setMistakeDiagnosis] = useState<{
    counterexample: string;
    expected: boolean;
    actual: boolean;
    trace: SimulationStep[];
  } | null>(null);

  // Structural issues (not deterministic / not minimal) — distinct from a
  // language mistake, since the automaton can be language-correct and still
  // fail these.
  const [structuralIssue, setStructuralIssue] = useState<string | null>(null);

  // Answer box for DFA-to-Regex problems (answerFormat === 'regex')
  const [regexAnswer, setRegexAnswer] = useState('');
  const [regexAnswerError, setRegexAnswerError] = useState<string | null>(null);

  const handleSelectProblem = (problem: PracticeProblem) => {
    setSelectedProblemId(problem.id);
    if (problem.starterAutomaton) {
      setUserAutomaton(JSON.parse(JSON.stringify(problem.starterAutomaton)));
    }
    setTestResults([]);
    setHasRunTests(false);
    setRevealedHintIdx(-1);
    setShowSolution(false);
    setShowWorkedSolution(false);
    setMistakeDiagnosis(null);
    setStructuralIssue(null);
    setRegexAnswer('');
    setRegexAnswerError(null);
  };

  const handleRunAllTests = () => {
    setStructuralIssue(null);

    if (selectedMeta?.requireDeterministic && !isAutomatonDeterministic(userAutomaton)) {
      setStructuralIssue(
        "Your automaton isn't deterministic yet — a DFA needs at most one transition per symbol from each state, and no ε-transitions. Fix that first, then run the tests again."
      );
      setTestResults([]);
      setHasRunTests(false);
      setMistakeDiagnosis(null);
      return;
    }

    const results = runBatchTests(userAutomaton, selectedProblem.testCases);
    setTestResults(results);
    setHasRunTests(true);

    const allPassed = results.length > 0 && results.every((r) => r.passed);
    if (allPassed) {
      setSolvedProblemIds((prev) => new Set([...prev, selectedProblem.id]));
      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#34d399', '#818cf8', '#f472b6'],
      });
    }

    // If we have a real reference solution (custom questions do), run a full
    // equivalence check — not just the sampled test cases — and if the two
    // disagree, trace the counterexample through the STUDENT'S OWN automaton
    // so they can see exactly where their design goes wrong.
    if (selectedProblem.referenceSolution) {
      const eq = checkAutomataEquivalence(userAutomaton, selectedProblem.referenceSolution);
      if (!eq.equivalent && eq.counterexample !== null) {
        const trace = simulateAutomatonStepByStep(userAutomaton, eq.counterexample);
        setMistakeDiagnosis({
          counterexample: eq.counterexample,
          expected: eq.acceptedByB,
          actual: eq.acceptedByA,
          trace,
        });
      } else {
        setMistakeDiagnosis(null);
        // Language-correct — for a minimization exercise, also check that
        // it's actually minimal, not just correct.
        if (selectedMeta?.minimalStateCount !== undefined) {
          const reachableCount = countReachableStates(userAutomaton);
          if (reachableCount > selectedMeta.minimalStateCount) {
            setStructuralIssue(
              `Your DFA accepts the correct language, but it isn't minimal — it has ${reachableCount} reachable states, and the minimum possible is ${selectedMeta.minimalStateCount}. Look for two states that behave identically on every possible future input and merge them.`
            );
          }
        }
      }
    } else {
      setMistakeDiagnosis(null);
    }
  };

  // For DFA-to-Regex problems: parse the student's typed regex, build an
  // automaton from it, and run the exact same test + equivalence pipeline
  // as the automaton-answer path above.
  const handleCheckRegexAnswer = () => {
    const trimmed = regexAnswer.trim();
    if (!trimmed) {
      setRegexAnswerError('Type a regular expression first.');
      return;
    }

    let studentAutomaton: AutomatonDefinition;
    try {
      studentAutomaton = convertRegexToNFA(trimmed).nfa;
    } catch (err) {
      setRegexAnswerError('Could not parse that regular expression. Try using |, *, and parentheses.');
      return;
    }
    setRegexAnswerError(null);
    setStructuralIssue(null);

    const results = runBatchTests(studentAutomaton, selectedProblem.testCases);
    setTestResults(results);
    setHasRunTests(true);

    const allPassed = results.length > 0 && results.every((r) => r.passed);
    if (allPassed) {
      setSolvedProblemIds((prev) => new Set([...prev, selectedProblem.id]));
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#34d399', '#818cf8', '#f472b6'],
      });
    }

    if (selectedProblem.referenceSolution) {
      const eq = checkAutomataEquivalence(studentAutomaton, selectedProblem.referenceSolution);
      if (!eq.equivalent && eq.counterexample !== null) {
        const trace = simulateAutomatonStepByStep(studentAutomaton, eq.counterexample);
        setMistakeDiagnosis({
          counterexample: eq.counterexample,
          expected: eq.acceptedByB,
          actual: eq.acceptedByA,
          trace,
        });
      } else {
        setMistakeDiagnosis(null);
      }
    }
  };

  const handleAddCustomProblem = () => {
    const trimmed = newRegex.trim();
    if (!trimmed) {
      setAddFormError('Enter a regular expression first.');
      return;
    }

    try {
      const { nfa, steps: thompsonSteps } = convertRegexToNFA(trimmed);
      const { dfa: rawDfa, steps: subsetSteps } = convertNFAToDFA(nfa);
      const { minimizedDfa, steps: minimizationSteps } = minimizeDFA(rawDfa);

      const id = `custom_${Date.now()}`;
      let problem: PracticeProblem;
      let meta: CustomProblemMeta;
      let derivation: CustomDerivation;

      switch (newKind) {
        case 'regex_to_nfa': {
          const testCases = generateTestCasesFromDFA(nfa);
          const hints = generateHintsFromDFA(
            nfa,
            'The reference NFA',
            `Walk through the regex "${trimmed}" operator by operator (union, concatenation, star) and build one small NFA fragment per operator — that's exactly what Thompson's Construction does.`
          );
          problem = {
            id,
            title: newTitle.trim() || `Regex → NFA: ${trimmed}`,
            category: 'regex',
            difficulty: newDifficulty,
            description: `Using Thompson's Construction (or any method you like), convert the regular expression "${trimmed}" into an NFA or ε-NFA. Any automaton that accepts exactly this language is correct — it doesn't need to match Thompson's construction exactly.`,
            formalLanguageSpec: `Convert: ${trimmed}  →  NFA`,
            alphabet: nfa.alphabet,
            testCases,
            starterAutomaton: {
              type: 'NFA',
              alphabet: nfa.alphabet,
              states: [{ id: 'q0', name: 'q0', x: 120, y: 160, isStart: true }],
              transitions: [],
              startStateId: 'q0',
              acceptStateIds: [],
            },
            hints,
            solutionExplanation: `Reveal the Worked Solution below to see "${trimmed}" derived step-by-step via Thompson's Construction into the reference NFA.`,
            referenceSolution: nfa,
          };
          meta = { kind: 'regex_to_nfa', answerFormat: 'automaton' };
          derivation = { thompsonSteps };
          break;
        }

        case 'nfa_to_dfa': {
          const testCases = generateTestCasesFromDFA(minimizedDfa);
          const hints = generateHintsFromDFA(
            minimizedDfa,
            'A correctly-converted DFA',
            `For each DFA state, it represents a SET of NFA states — compute where each symbol leads from every NFA state in that set (plus ε-closure) to find the next DFA state.`
          );
          problem = {
            id,
            title: newTitle.trim() || `NFA → DFA: L(${trimmed})`,
            category: 'conversion',
            difficulty: newDifficulty,
            description: `The NFA shown below accepts the language of the regular expression "${trimmed}". Use the Subset Construction algorithm to build an equivalent DFA — every state must have exactly one transition per symbol, and no ε-transitions are allowed.`,
            formalLanguageSpec: `L = L(${trimmed})  (given as an NFA below)`,
            alphabet: nfa.alphabet,
            testCases,
            starterAutomaton: {
              type: 'DFA',
              alphabet: nfa.alphabet,
              states: [{ id: 'q0', name: 'q0', x: 120, y: 160, isStart: true }],
              transitions: [],
              startStateId: 'q0',
              acceptStateIds: [],
            },
            hints,
            solutionExplanation: `Reveal the Worked Solution below to see the given NFA converted step-by-step via Subset Construction into the equivalent DFA.`,
            referenceSolution: minimizedDfa,
          };
          meta = { kind: 'nfa_to_dfa', givenAutomaton: nfa, answerFormat: 'automaton', requireDeterministic: true };
          derivation = { subsetSteps };
          break;
        }

        case 'dfa_minimize': {
          const testCases = generateTestCasesFromDFA(minimizedDfa);
          const hints = generateHintsFromDFA(
            minimizedDfa,
            'The minimal DFA',
            `Two states are equivalent if, for every possible future input, they always agree on accept/reject — start by grouping accepting vs non-accepting states, then repeatedly split groups whose members disagree on where some symbol leads.`
          );
          problem = {
            id,
            title: newTitle.trim() || `Minimize DFA: L(${trimmed})`,
            category: 'conversion',
            difficulty: newDifficulty,
            description: `The DFA shown below (built via subset construction, not yet minimized) accepts the language of "${trimmed}". Use the Table-Filling algorithm to find the minimal equivalent DFA.`,
            formalLanguageSpec: `L = L(${trimmed})  (given as a non-minimal DFA below)`,
            alphabet: rawDfa.alphabet,
            testCases,
            starterAutomaton: {
              type: 'DFA',
              alphabet: rawDfa.alphabet,
              states: [{ id: 'q0', name: 'q0', x: 120, y: 160, isStart: true }],
              transitions: [],
              startStateId: 'q0',
              acceptStateIds: [],
            },
            hints,
            solutionExplanation: `Reveal the Worked Solution below to see the given DFA minimized step-by-step via the Table-Filling algorithm.`,
            referenceSolution: minimizedDfa,
          };
          meta = {
            kind: 'dfa_minimize',
            givenAutomaton: rawDfa,
            answerFormat: 'automaton',
            requireDeterministic: true,
            minimalStateCount: minimizedDfa.states.length,
          };
          derivation = { minimizationSteps };
          break;
        }

        case 'dfa_to_regex': {
          const testCases = generateTestCasesFromDFA(minimizedDfa);
          const hints = generateHintsFromDFA(
            minimizedDfa,
            'The DFA shown above',
            `Trace a few short strings through the DFA by hand — note which ones end in an accepting state, and look for a repeating pattern in their structure.`
          );
          const elimination = convertDFAToRegex(minimizedDfa);
          problem = {
            id,
            title: newTitle.trim() || `DFA → Regex Challenge (${minimizedDfa.states.length} states)`,
            category: 'conversion',
            difficulty: newDifficulty,
            description: `The DFA shown below accepts a certain language. Write a regular expression that describes exactly the strings it accepts.`,
            formalLanguageSpec: `L = ?  (find the regex for the DFA below)`,
            alphabet: minimizedDfa.alphabet,
            testCases,
            hints,
            solutionExplanation: `Reveal the Worked Solution below to see the given DFA converted step-by-step via State Elimination into the correct regex.`,
            referenceSolution: minimizedDfa,
          };
          meta = { kind: 'dfa_to_regex', givenAutomaton: minimizedDfa, answerFormat: 'regex' };
          derivation = { eliminationSteps: elimination.steps, answerRegex: trimmed };
          break;
        }

        case 'design':
        default: {
          const testCases = generateTestCasesFromDFA(minimizedDfa);
          const hints = generateHintsFromDFA(
            minimizedDfa,
            'The minimal DFA for this language',
            `Trace a few short strings by hand against the regex ${trimmed} before building — it'll tell you which states you actually need.`
          );
          problem = {
            id,
            title: newTitle.trim() || `Custom: L(${trimmed})`,
            category: 'regex',
            difficulty: newDifficulty,
            description: `Design a DFA (or NFA) over the alphabet {${minimizedDfa.alphabet.join(
              ', '
            )}} that accepts exactly the strings matching the regular expression: ${trimmed}`,
            formalLanguageSpec: `L = L(${trimmed})`,
            alphabet: minimizedDfa.alphabet,
            testCases,
            starterAutomaton: {
              type: 'DFA',
              alphabet: minimizedDfa.alphabet,
              states: [{ id: 'q0', name: 'q0', x: 120, y: 160, isStart: true }],
              transitions: [],
              startStateId: 'q0',
              acceptStateIds: [],
            },
            hints,
            solutionExplanation: `This problem's target language comes from the regular expression "${trimmed}". Reveal the Worked Solution below to see it derived step-by-step via Thompson's construction, then subset construction, into the ${minimizedDfa.states.length}-state minimal DFA shown as the reference.`,
            referenceSolution: minimizedDfa,
          };
          meta = { kind: 'design', answerFormat: 'automaton' };
          derivation = { thompsonSteps, subsetSteps };
          break;
        }
      }

      setCustomProblems((prev) => [...prev, problem]);
      setCustomDerivations((prev) => ({ ...prev, [id]: derivation }));
      setCustomProblemMeta((prev) => ({ ...prev, [id]: meta }));
      handleSelectProblem(problem);
      setShowAddForm(false);
      setNewRegex('');
      setNewTitle('');
      setAddFormError(null);
    } catch (err) {
      setAddFormError(
        'Could not build that regular expression. Try something like (a|b)*abb using |, *, and parentheses.'
      );
    }
  };

  const filteredProblems = allProblems.filter((p) => {
    const matchesCat =
      activeCategory === 'all'
        ? true
        : activeCategory === 'mine'
        ? p.id.startsWith('custom_')
        : p.category === activeCategory;
    const matchesDiff = difficultyFilter === 'all' || p.difficulty === difficultyFilter;
    return matchesCat && matchesDiff;
  });

  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = selectedProblem.testCases.length;
  const isSolved = solvedProblemIds.has(selectedProblem.id);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Header & Progress */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">
                Automata Interactive Challenges
              </span>
              <span className="text-xs text-slate-500">
                Solved: {solvedProblemIds.size} / {allProblems.length}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Interactive Practice & Problem Verification Lab
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Construct automata, verify with rigorous test vectors, and receive instant feedback.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-gray-200 text-xs text-slate-700">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Score: <strong className="text-indigo-600">{solvedProblemIds.size * 100} pts</strong></span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Problems' },
              { id: 'dfa_design', label: 'DFA Design' },
              { id: 'pda_tm', label: 'PDA & Turing Machines' },
              { id: 'mine', label: 'My Questions' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Difficulties */}
          <div className="flex items-center gap-1.5">
            {['all', 'Easy', 'Medium', 'Hard'].map((diff) => (
              <button
                key={diff}
                onClick={() => setDifficultyFilter(diff)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  difficultyFilter === diff
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {diff === 'all' ? 'All Levels' : diff}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Problem Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Problem Catalog List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Challenge Catalog ({filteredProblems.length})
          </h3>

          {/* Add Your Own Question */}
          <div className="bg-white border border-dashed border-indigo-300 rounded-xl p-3">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1.5 py-1"
              >
                <PlusCircle className="w-4 h-4" />
                Add Your Own Question
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">New Question from a Regex</div>
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as ConversionKind)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="design">Design an Automaton for L(regex)</option>
                  <option value="regex_to_nfa">Convert: Regex → NFA</option>
                  <option value="nfa_to_dfa">Convert: NFA → DFA</option>
                  <option value="dfa_minimize">Convert: Minimize a DFA</option>
                  <option value="dfa_to_regex">Convert: DFA → Regex</option>
                </select>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={newRegex}
                  onChange={(e) => setNewRegex(e.target.value)}
                  placeholder="Regex, e.g. (a|b)*abb"
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCustomProblem();
                  }}
                />
                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                {addFormError && <div className="text-[11px] text-rose-600">{addFormError}</div>}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddCustomProblem}
                    className="flex-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
                  >
                    Generate Problem
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setAddFormError(null);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-600 transition"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  We compute the correct minimal DFA for this regex automatically — it's used to auto-generate test cases, hints, and mistake detection.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredProblems.map((prob) => {
              const isSel = prob.id === selectedProblemId;
              const isProbSolved = solvedProblemIds.has(prob.id);

              return (
                <button
                  key={prob.id}
                  onClick={() => handleSelectProblem(prob)}
                  className={`w-full p-3.5 rounded-xl text-left border transition ${
                    isSel
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm'
                      : 'bg-white border-gray-200 text-slate-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-xs text-slate-900 line-clamp-1">
                      {prob.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          prob.difficulty === 'Easy'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : prob.difficulty === 'Medium'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {prob.difficulty}
                      </span>
                      {isProbSolved && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] font-mono text-indigo-600 truncate font-medium">
                    {prob.formalLanguageSpec}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Challenge Editor & Test Suite */}
        <div className="lg:col-span-8 space-y-5">
          {/* Problem Spec Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedProblem.title}
                </h3>
                <div className="font-mono text-xs text-indigo-600 mt-0.5 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 inline-block font-semibold">
                  {selectedProblem.formalLanguageSpec}
                </div>
              </div>

              <button
                onClick={selectedMeta?.answerFormat === 'regex' ? handleCheckRegexAnswer : handleRunAllTests}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
              >
                <Play className="w-4 h-4" />
                {selectedMeta?.answerFormat === 'regex' ? 'Check My Regex' : 'Run All Test Vectors'}
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedProblem.description}
            </p>
          </div>

          {/* Given automaton (for conversion-type problems: NFA to convert, non-minimal DFA to minimize, or DFA to describe) */}
          {selectedMeta?.givenAutomaton && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Given:{' '}
                {selectedMeta.kind === 'nfa_to_dfa'
                  ? 'NFA to Convert'
                  : selectedMeta.kind === 'dfa_minimize'
                  ? 'Non-Minimal DFA to Minimize'
                  : 'DFA to Describe'}
              </span>
              <AutomataCanvas automaton={selectedMeta.givenAutomaton} onChange={() => {}} readOnly />
            </div>
          )}

          {/* Answer: either build an automaton, or type a regex */}
          {selectedMeta?.answerFormat === 'regex' ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Your Answer (Regular Expression)
              </span>
              <input
                type="text"
                value={regexAnswer}
                onChange={(e) => setRegexAnswer(e.target.value)}
                placeholder="e.g. (a|b)*abb"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCheckRegexAnswer();
                }}
              />
              {regexAnswerError && <div className="text-[11px] text-rose-600">{regexAnswerError}</div>}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Your Answer (Automaton Design Canvas)
                </span>
                <button
                  onClick={() => {
                    if (selectedProblem.starterAutomaton) {
                      setUserAutomaton(JSON.parse(JSON.stringify(selectedProblem.starterAutomaton)));
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Starter
                </button>
              </div>
              <AutomataCanvas
                automaton={userAutomaton}
                onChange={setUserAutomaton}
              />
            </div>
          )}

          {/* Structural Issue (not deterministic, or correct-but-not-minimal) */}
          {structuralIssue && (
            <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Structural Issue</h4>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{structuralIssue}</p>
            </div>
          )}

          {/* Test Case Results Suite */}
          {hasRunTests && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Test Results ({passedCount}/{totalCount} Passed)
                  </span>
                </div>
                {passedCount === totalCount ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    ALL TEST CASES PASSED!
                  </div>
                ) : (
                  <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                    {totalCount - passedCount} Failing Test Cases
                  </div>
                )}
              </div>

              {/* Test table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {testResults.map((tr, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                      tr.passed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        Input: "{tr.input || 'ε'}"
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        Expected: {tr.expected ? 'ACCEPT' : 'REJECT'} | Got: {tr.actual ? 'ACCEPT' : 'REJECT'}
                      </div>
                    </div>
                    {tr.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mistake Diagnosis (only when we have a real reference solution to compare against) */}
          {mistakeDiagnosis && (
            <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                  Mistake Found — Compared Against the Correct Solution
                </h4>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                On input{' '}
                <span className="font-mono font-bold text-rose-700">
                  "{mistakeDiagnosis.counterexample || 'ε'}"
                </span>
                , the correct answer is{' '}
                <strong>{mistakeDiagnosis.expected ? 'ACCEPT' : 'REJECT'}</strong>, but your automaton says{' '}
                <strong>{mistakeDiagnosis.actual ? 'ACCEPT' : 'REJECT'}</strong>. This is the shortest input
                where they disagree.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1 max-h-56 overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Trace through YOUR automaton:
                </div>
                {mistakeDiagnosis.trace.map((st, idx) => (
                  <div key={idx} className="text-xs font-mono text-slate-700">
                    {st.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worked Solution (only for problems with a computed reference solution) */}
          {selectedProblem.referenceSolution && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Worked Solution
                </h4>
                <button
                  onClick={() => setShowWorkedSolution((s) => !s)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {showWorkedSolution ? 'Hide' : 'Reveal'} Worked Solution
                </button>
              </div>

              {showWorkedSolution && (
                <div className="space-y-4 animate-in fade-in">
                  {selectedDerivation?.answerRegex && (
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Correct Regular Expression
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 font-mono text-sm text-indigo-700 font-bold">
                        {selectedDerivation.answerRegex}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {selectedMeta?.kind === 'regex_to_nfa'
                        ? 'Reference NFA'
                        : selectedMeta?.kind === 'dfa_to_regex'
                        ? 'The Given DFA'
                        : 'Reference (Minimal) DFA'}
                    </div>
                    <AutomataCanvas
                      automaton={selectedProblem.referenceSolution}
                      onChange={() => {}}
                      readOnly
                    />
                  </div>

                  {selectedDerivation?.thompsonSteps && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Regex → NFA (Thompson's Construction)
                      </div>
                      {selectedDerivation.thompsonSteps.map((st) => (
                        <div key={st.step} className="p-2.5 bg-slate-50 rounded-lg border border-gray-200 text-xs">
                          <div className="font-semibold text-amber-700 mb-0.5">
                            Step {st.step}: built '{st.resultLabel}'
                          </div>
                          <div className="text-slate-700 leading-relaxed">{st.explanation}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDerivation?.subsetSteps && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        NFA → DFA (Subset Construction)
                      </div>
                      {selectedDerivation.subsetSteps.map((st) => (
                        <div key={st.step} className="p-2.5 bg-slate-50 rounded-lg border border-gray-200 text-xs">
                          <div className="font-semibold text-amber-700 mb-0.5">
                            Step {st.step}: DFA state {st.dfaStateName}
                          </div>
                          <div className="text-slate-700 leading-relaxed">{st.explanation}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDerivation?.minimizationSteps && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        DFA Minimization (Table-Filling)
                      </div>
                      {selectedDerivation.minimizationSteps.map((st, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-gray-200 text-xs">
                          <div className="font-semibold text-indigo-600 mb-0.5">{st.notes}</div>
                          {st.partitions.length > 0 && (
                            <div className="font-mono text-slate-700">
                              Partitions: {st.partitions.map((p) => `{${p.join(', ')}}`).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDerivation?.eliminationSteps && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        DFA → Regex (State Elimination)
                      </div>
                      {selectedDerivation.eliminationSteps.map((st) => (
                        <div key={st.step} className="p-2.5 bg-slate-50 rounded-lg border border-gray-200 text-xs">
                          <div className="font-semibold text-amber-700 mb-0.5">
                            Step {st.step}: {st.eliminatedState}
                          </div>
                          <div className="text-slate-700 leading-relaxed">{st.explanation}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Progressive Hints & Solution Guide */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                Progressive Hints & Explanations
              </h4>
              <button
                onClick={() => setShowSolution((s) => !s)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                {showSolution ? 'Hide Solution Guide' : 'Reveal Solution Guide'}
              </button>
            </div>

            {/* Hint Accordion */}
            <div className="space-y-2">
              {selectedProblem.hints.map((hint, idx) => {
                const isRevealed = revealedHintIdx >= idx;
                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-gray-200 text-xs"
                  >
                    {isRevealed ? (
                      <div className="text-slate-800 leading-relaxed">
                        <strong className="text-indigo-600 mr-1.5">Hint {idx + 1}:</strong>
                        {hint}
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevealedHintIdx(idx)}
                        className="text-slate-600 hover:text-slate-900 flex items-center justify-between w-full font-medium"
                      >
                        <span>Unlock Hint {idx + 1}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Full Solution Explanation */}
            {showSolution && (
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs space-y-2 animate-in fade-in">
                <div className="font-bold text-indigo-900">Detailed Theoretical Explanation:</div>
                <p className="text-slate-700 leading-relaxed">
                  {selectedProblem.solutionExplanation}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};