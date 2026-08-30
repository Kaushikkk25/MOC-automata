import {
  AutomatonDefinition,
  AutomatonType,
  BatchTestResult,
  CFGRule,
  ContextFreeGrammar,
  MinimizationStep,
  SimulationStep,
  StateEliminationStep,
  StateNode,
  SubsetConstructionStep,
  TransitionEdge,
} from '../types/automata';

// Helper to normalize epsilons
export const EPSILON = 'ε';
export const isEpsilon = (sym: string) => sym === 'ε' || sym === 'eps' || sym === 'e' || sym === 'λ';

// Generate unique IDs
let idCounter = 100;
export function generateId(prefix: string = 'id'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

// -------------------------------------------------------------
// EPSILON CLOSURE & NFA SIMULATION
// -------------------------------------------------------------
export function getEpsilonClosure(
  stateIds: string[],
  transitions: TransitionEdge[]
): string[] {
  const closure = new Set<string>(stateIds);
  const queue = [...stateIds];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const t of transitions) {
      if (t.from === curr) {
        const hasEps = t.symbols.some((s) => isEpsilon(s));
        if (hasEps && !closure.has(t.to)) {
          closure.add(t.to);
          queue.push(t.to);
        }
      }
    }
  }
  return Array.from(closure);
}

export function simulateAutomatonStepByStep(
  automaton: AutomatonDefinition,
  input: string
): SimulationStep[] {
  if (automaton.type === 'PDA') {
    return simulatePDAStepByStep(automaton, input);
  }
  if (automaton.type === 'TM') {
    return simulateTMStepByStep(automaton, input);
  }

  // DFA & NFA & ENFA
  const steps: SimulationStep[] = [];
  let currentStates = [automaton.startStateId];
  if (automaton.type === 'NFA' || automaton.type === 'ENFA') {
    currentStates = getEpsilonClosure(currentStates, automaton.transitions);
  }

  steps.push({
    stepIndex: 0,
    currentStates: [...currentStates],
    remainingInput: input,
    consumedInput: '',
    message: `Initial state: ${currentStates.map((id) => getStateName(automaton, id)).join(', ')}`,
    isAccepted: false,
  });

  let consumed = '';
  for (let i = 0; i < input.length; i++) {
    const symbol = input[i];
    consumed += symbol;
    const remaining = input.slice(i + 1);

    const nextStatesSet = new Set<string>();
    for (const stId of currentStates) {
      for (const t of automaton.transitions) {
        if (t.from === stId && t.symbols.includes(symbol)) {
          nextStatesSet.add(t.to);
        }
      }
    }

    let nextStates = Array.from(nextStatesSet);
    if (automaton.type === 'NFA' || automaton.type === 'ENFA') {
      nextStates = getEpsilonClosure(nextStates, automaton.transitions);
    }

    currentStates = nextStates;
    const isDeadEnd = currentStates.length === 0;
    const isAccepted =
      i === input.length - 1 &&
      currentStates.some((id) => automaton.acceptStateIds.includes(id));

    steps.push({
      stepIndex: i + 1,
      currentStates: [...currentStates],
      remainingInput: remaining,
      consumedInput: consumed,
      isDeadEnd,
      isAccepted,
      message: isDeadEnd
        ? `No valid transition for symbol '${symbol}'. Automaton stuck.`
        : `Read '${symbol}' → Current: ${currentStates.map((id) => getStateName(automaton, id)).join(', ')}`,
    });

    if (isDeadEnd) break;
  }

  const lastStep = steps[steps.length - 1];
  const finalAccepted =
    lastStep.currentStates.some((id) => automaton.acceptStateIds.includes(id)) &&
    lastStep.remainingInput.length === 0;
  lastStep.isAccepted = finalAccepted;

  return steps;
}

export function testAutomatonInput(
  automaton: AutomatonDefinition,
  input: string
): boolean {
  const steps = simulateAutomatonStepByStep(automaton, input);
  const last = steps[steps.length - 1];
  return Boolean(last?.isAccepted);
}

export function runBatchTests(
  automaton: AutomatonDefinition,
  testCases: Array<{ input: string; expected: boolean }>
): BatchTestResult[] {
  return testCases.map((tc) => {
    const steps = simulateAutomatonStepByStep(automaton, tc.input);
    const last = steps[steps.length - 1];
    const actual = Boolean(last?.isAccepted);
    return {
      input: tc.input,
      expected: tc.expected,
      actual,
      passed: actual === tc.expected,
      stepsCount: steps.length,
      trace: steps.map((s) => s.message || ''),
    };
  });
}

export function getStateName(automaton: AutomatonDefinition, id: string): string {
  const st = automaton.states.find((s) => s.id === id);
  return st ? st.name : id;
}

// -------------------------------------------------------------
// PDA SIMULATION
// -------------------------------------------------------------
function simulatePDAStepByStep(
  automaton: AutomatonDefinition,
  input: string
): SimulationStep[] {
  const initialStack = [automaton.initialStackSymbol || 'Z0'];
  const steps: SimulationStep[] = [];

  interface PDAConfig {
    stateId: string;
    stack: string[];
    remaining: string;
    consumed: string;
    path: string[];
  }

  const initialConfig: PDAConfig = {
    stateId: automaton.startStateId,
    stack: [...initialStack],
    remaining: input,
    consumed: '',
    path: [`Started at ${getStateName(automaton, automaton.startStateId)} with stack [${initialStack.join(',')}]`],
  };

  steps.push({
    stepIndex: 0,
    currentStates: [initialConfig.stateId],
    remainingInput: input,
    consumedInput: '',
    stack: [...initialConfig.stack],
    message: initialConfig.path[0],
    isAccepted:
      input.length === 0 && automaton.acceptStateIds.includes(initialConfig.stateId),
  });

  // Breadth-first search for PDA
  let queue: PDAConfig[] = [initialConfig];
  let maxDepth = 40;
  let acceptedConfig: PDAConfig | null = null;
  let historySteps: PDAConfig[] = [initialConfig];

  while (queue.length > 0 && maxDepth-- > 0) {
    const current = queue.shift()!;

    if (
      current.remaining.length === 0 &&
      (automaton.acceptStateIds.includes(current.stateId) ||
        (automaton.acceptStateIds.length === 0 && current.stack.length === 0))
    ) {
      acceptedConfig = current;
      break;
    }

    const nextConfigs: PDAConfig[] = [];
    for (const t of automaton.transitions) {
      if (t.from === current.stateId && t.pdaOps) {
        for (const op of t.pdaOps) {
          const isEpsInput = isEpsilon(op.input) || op.input === '';
          const matchesInput = isEpsInput || (current.remaining.length > 0 && current.remaining[0] === op.input);

          if (!matchesInput) continue;

          const topOfStack = current.stack.length > 0 ? current.stack[current.stack.length - 1] : '';
          const matchesPop = isEpsilon(op.pop) || op.pop === '' || topOfStack === op.pop;

          if (!matchesPop) continue;

          const newStack = [...current.stack];
          if (!isEpsilon(op.pop) && op.pop !== '') {
            newStack.pop();
          }

          if (!isEpsilon(op.push) && op.push !== '') {
            // push symbols in reverse
            const pushSyms = op.push.split('').filter((s) => s.trim() !== '');
            for (let k = pushSyms.length - 1; k >= 0; k--) {
              newStack.push(pushSyms[k]);
            }
          }

          const newRemaining = isEpsInput ? current.remaining : current.remaining.slice(1);
          const newConsumed = isEpsInput ? current.consumed : current.consumed + current.remaining[0];

          const cfg: PDAConfig = {
            stateId: t.to,
            stack: newStack,
            remaining: newRemaining,
            consumed: newConsumed,
            path: [
              ...current.path,
              `Read '${isEpsInput ? 'ε' : current.remaining[0]}', popped '${op.pop || 'ε'}', pushed '${op.push || 'ε'}' → State ${getStateName(automaton, t.to)}, Stack: [${newStack.join(',')}]`,
            ],
          };
          nextConfigs.push(cfg);
        }
      }
    }

    if (nextConfigs.length > 0) {
      queue.push(...nextConfigs.slice(0, 10)); // limit branching
      historySteps.push(nextConfigs[0]);
    }
  }

  // Construct readable steps
  if (acceptedConfig) {
    return acceptedConfig.path.map((msg, idx) => ({
      stepIndex: idx,
      currentStates: [automaton.acceptStateIds[0] || automaton.startStateId],
      remainingInput: idx === acceptedConfig!.path.length - 1 ? '' : '...',
      consumedInput: input,
      stack: acceptedConfig!.stack,
      message: msg,
      isAccepted: idx === acceptedConfig!.path.length - 1,
    }));
  }

  return historySteps.map((cfg, idx) => ({
    stepIndex: idx,
    currentStates: [cfg.stateId],
    remainingInput: cfg.remaining,
    consumedInput: cfg.consumed,
    stack: cfg.stack,
    message: cfg.path[cfg.path.length - 1] || 'Executing step',
    isAccepted: false,
  }));
}

// -------------------------------------------------------------
// TURING MACHINE SIMULATION
// -------------------------------------------------------------
function simulateTMStepByStep(
  automaton: AutomatonDefinition,
  input: string
): SimulationStep[] {
  const blank = automaton.blankSymbol || 'B';
  const tape: string[] = input.length > 0 ? input.split('') : [blank];
  let head = 0;
  let currentState = automaton.startStateId;

  const steps: SimulationStep[] = [];
  let maxSteps = 100;
  let stepCount = 0;

  while (stepCount < maxSteps) {
    if (head < 0) {
      tape.unshift(blank);
      head = 0;
    }
    if (head >= tape.length) {
      tape.push(blank);
    }

    const currentSym = tape[head] || blank;
    const isAccept = automaton.acceptStateIds.includes(currentState);

    steps.push({
      stepIndex: stepCount,
      currentStates: [currentState],
      remainingInput: tape.slice(head).join(''),
      consumedInput: tape.slice(0, head).join(''),
      tape: [...tape],
      headPosition: head,
      message: `State ${getStateName(automaton, currentState)}, Head at pos ${head} reading '${currentSym}'`,
      isAccepted: isAccept,
    });

    if (isAccept) break;

    // Find transition
    let transitionFound = false;
    for (const t of automaton.transitions) {
      if (t.from === currentState && t.tmOps) {
        for (const op of t.tmOps) {
          if (op.read === currentSym || (op.read === 'B' && currentSym === blank)) {
            tape[head] = op.write;
            if (op.dir === 'L') head -= 1;
            else if (op.dir === 'R') head += 1;
            currentState = t.to;
            transitionFound = true;
            break;
          }
        }
      }
      if (transitionFound) break;
    }

    if (!transitionFound) {
      steps.push({
        stepIndex: stepCount + 1,
        currentStates: [currentState],
        remainingInput: tape.slice(head).join(''),
        consumedInput: tape.slice(0, head).join(''),
        tape: [...tape],
        headPosition: head,
        isDeadEnd: true,
        isAccepted: false,
        message: `Halted: No transition from state ${getStateName(automaton, currentState)} on '${currentSym}'.`,
      });
      break;
    }

    stepCount++;
  }

  return steps;
}

// -------------------------------------------------------------
// THOMPSON'S CONSTRUCTION (REGEX -> NFA)
// -------------------------------------------------------------
export function convertRegexToNFA(regexStr: string): AutomatonDefinition {
  const cleanRegex = regexStr.replace(/\s+/g, '');
  if (!cleanRegex || cleanRegex === 'ε' || cleanRegex === 'eps') {
    const s0 = { id: 'q0', name: 'q0', x: 120, y: 180, isStart: true };
    const s1 = { id: 'q1', name: 'q1', x: 280, y: 180, isAccept: true };
    return {
      type: 'ENFA',
      alphabet: [],
      states: [s0, s1],
      transitions: [{ id: 't0', from: 'q0', to: 'q1', symbols: ['ε'] }],
      startStateId: 'q0',
      acceptStateIds: ['q1'],
    };
  }

  // Parse regex into postfix notation
  const postfix = infixToPostfix(cleanRegex);
  const nfa = buildNFAFromPostfix(postfix);

  // Layout states neatly in grid
  layoutNFAStates(nfa.states);
  return nfa;
}

function insertExplicitConcat(regex: string): string {
  let output = '';
  for (let i = 0; i < regex.length; i++) {
    const c1 = regex[i];
    output += c1;
    if (i + 1 < regex.length) {
      const c2 = regex[i + 1];
      const isC1Operand = c1 !== '(' && c1 !== '|' && c1 !== '+';
      const isC2Operand = c2 !== ')' && c2 !== '|' && c2 !== '+' && c2 !== '*' && c2 !== '?';
      if (isC1Operand && isC2Operand) {
        output += '.';
      }
    }
  }
  return output;
}

function infixToPostfix(regex: string): string {
  const formatted = insertExplicitConcat(regex);
  const prec: Record<string, number> = { '*': 3, '+': 3, '?': 3, '.': 2, '|': 1 };
  let postfix = '';
  const stack: string[] = [];

  for (let i = 0; i < formatted.length; i++) {
    const c = formatted[i];
    if (c === '(') {
      stack.push(c);
    } else if (c === ')') {
      while (stack.length > 0 && stack[stack.length - 1] !== '(') {
        postfix += stack.pop();
      }
      stack.pop(); // pop '('
    } else if (c in prec) {
      while (
        stack.length > 0 &&
        stack[stack.length - 1] !== '(' &&
        prec[stack[stack.length - 1]] >= prec[c]
      ) {
        postfix += stack.pop();
      }
      stack.push(c);
    } else {
      postfix += c;
    }
  }

  while (stack.length > 0) {
    postfix += stack.pop();
  }
  return postfix;
}

interface MiniNFA {
  start: StateNode;
  accept: StateNode;
  states: StateNode[];
  transitions: TransitionEdge[];
}

let nfaStateCounter = 0;
function createNFAState(namePrefix = 'q'): StateNode {
  const id = `q${nfaStateCounter++}`;
  return { id, name: id, x: 100, y: 150 };
}

function buildNFAFromPostfix(postfix: string): AutomatonDefinition {
  nfaStateCounter = 0;
  const stack: MiniNFA[] = [];
  const alphabetSet = new Set<string>();

  for (const c of postfix) {
    if (c === '.') {
      // Concatenation
      if (stack.length < 2) continue;
      const n2 = stack.pop()!;
      const n1 = stack.pop()!;
      // transition from n1.accept to n2.start with ε
      const epsTrans: TransitionEdge = {
        id: generateId('t'),
        from: n1.accept.id,
        to: n2.start.id,
        symbols: ['ε'],
      };
      stack.push({
        start: n1.start,
        accept: n2.accept,
        states: [...n1.states, ...n2.states],
        transitions: [...n1.transitions, ...n2.transitions, epsTrans],
      });
    } else if (c === '|' || c === '+') {
      // Union
      if (stack.length < 2) continue;
      const n2 = stack.pop()!;
      const n1 = stack.pop()!;
      const start = createNFAState();
      const accept = createNFAState();

      const t1: TransitionEdge = { id: generateId('t'), from: start.id, to: n1.start.id, symbols: ['ε'] };
      const t2: TransitionEdge = { id: generateId('t'), from: start.id, to: n2.start.id, symbols: ['ε'] };
      const t3: TransitionEdge = { id: generateId('t'), from: n1.accept.id, to: accept.id, symbols: ['ε'] };
      const t4: TransitionEdge = { id: generateId('t'), from: n2.accept.id, to: accept.id, symbols: ['ε'] };

      stack.push({
        start,
        accept,
        states: [start, ...n1.states, ...n2.states, accept],
        transitions: [...n1.transitions, ...n2.transitions, t1, t2, t3, t4],
      });
    } else if (c === '*') {
      // Kleene Star
      if (stack.length < 1) continue;
      const n1 = stack.pop()!;
      const start = createNFAState();
      const accept = createNFAState();

      const t1: TransitionEdge = { id: generateId('t'), from: start.id, to: n1.start.id, symbols: ['ε'] };
      const t2: TransitionEdge = { id: generateId('t'), from: start.id, to: accept.id, symbols: ['ε'] };
      const t3: TransitionEdge = { id: generateId('t'), from: n1.accept.id, to: n1.start.id, symbols: ['ε'] };
      const t4: TransitionEdge = { id: generateId('t'), from: n1.accept.id, to: accept.id, symbols: ['ε'] };

      stack.push({
        start,
        accept,
        states: [start, ...n1.states, accept],
        transitions: [...n1.transitions, t1, t2, t3, t4],
      });
    } else {
      // Basic symbol
      const sym = isEpsilon(c) ? 'ε' : c;
      if (sym !== 'ε') alphabetSet.add(sym);

      const start = createNFAState();
      const accept = createNFAState();
      const t: TransitionEdge = {
        id: generateId('t'),
        from: start.id,
        to: accept.id,
        symbols: [sym],
      };
      stack.push({
        start,
        accept,
        states: [start, accept],
        transitions: [t],
      });
    }
  }

  const finalMini = stack.pop() || {
    start: createNFAState(),
    accept: createNFAState(),
    states: [],
    transitions: [],
  };

  // Mark start & accept
  finalMini.start.isStart = true;
  finalMini.accept.isAccept = true;

  return {
    type: 'ENFA',
    alphabet: Array.from(alphabetSet).sort(),
    states: finalMini.states,
    transitions: finalMini.transitions,
    startStateId: finalMini.start.id,
    acceptStateIds: [finalMini.accept.id],
  };
}

function layoutNFAStates(states: StateNode[]) {
  const count = states.length;
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const spacingX = 140;
  const spacingY = 120;

  states.forEach((st, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    st.x = 80 + col * spacingX;
    st.y = 80 + row * spacingY;
  });
}

// -------------------------------------------------------------
// SUBSET / POWERSET CONSTRUCTION (NFA -> DFA)
// -------------------------------------------------------------
export function convertNFAToDFA(
  nfa: AutomatonDefinition
): {
  dfa: AutomatonDefinition;
  steps: SubsetConstructionStep[];
} {
  const alphabet = nfa.alphabet.filter((s) => !isEpsilon(s));
  const initialClosure = getEpsilonClosure([nfa.startStateId], nfa.transitions).sort();

  const subsetMap = new Map<string, string>(); // sorted stringified set -> DFA state ID
  const dfaStates: StateNode[] = [];
  const dfaTransitions: TransitionEdge[] = [];
  const steps: SubsetConstructionStep[] = [];

  let stateIdx = 0;
  const getDfaStateName = (set: string[]) => {
    const key = set.join(',');
    if (!subsetMap.has(key)) {
      const name = String.fromCharCode(65 + stateIdx++); // A, B, C...
      subsetMap.set(key, name);
    }
    return subsetMap.get(key)!;
  };

  const queue: string[][] = [initialClosure];
  const visited = new Set<string>();
  const startDfaName = getDfaStateName(initialClosure);

  while (queue.length > 0) {
    const currentSet = queue.shift()!;
    const key = currentSet.join(',');
    if (visited.has(key)) continue;
    visited.add(key);

    const dfaName = getDfaStateName(currentSet);
    const isAccept = currentSet.some((stId) => nfa.acceptStateIds.includes(stId));
    const isStart = dfaName === startDfaName;

    dfaStates.push({
      id: dfaName,
      name: dfaName,
      x: 100 + (dfaStates.length % 4) * 160,
      y: 100 + Math.floor(dfaStates.length / 4) * 140,
      isStart,
      isAccept,
    });

    const stepTransitionRecord: Record<string, { targetDfaState: string; targetNfaSet: string[] }> = {};

    for (const sym of alphabet) {
      // Find targets on sym
      const reachSet = new Set<string>();
      for (const stId of currentSet) {
        for (const t of nfa.transitions) {
          if (t.from === stId && t.symbols.includes(sym)) {
            reachSet.add(t.to);
          }
        }
      }

      const targetClosure = getEpsilonClosure(Array.from(reachSet), nfa.transitions).sort();
      if (targetClosure.length > 0) {
        const targetDfaName = getDfaStateName(targetClosure);
        const targetKey = targetClosure.join(',');

        stepTransitionRecord[sym] = {
          targetDfaState: targetDfaName,
          targetNfaSet: targetClosure.map((id) => getStateName(nfa, id)),
        };

        // Add or merge transition
        const existing = dfaTransitions.find((t) => t.from === dfaName && t.to === targetDfaName);
        if (existing) {
          if (!existing.symbols.includes(sym)) existing.symbols.push(sym);
        } else {
          dfaTransitions.push({
            id: generateId('dfa_t'),
            from: dfaName,
            to: targetDfaName,
            symbols: [sym],
          });
        }

        if (!visited.has(targetKey)) {
          queue.push(targetClosure);
        }
      } else {
        stepTransitionRecord[sym] = {
          targetDfaState: '∅ (Dead State)',
          targetNfaSet: [],
        };
      }
    }

    steps.push({
      step: steps.length + 1,
      dfaStateName: dfaName,
      nfaStateSet: currentSet.map((id) => getStateName(nfa, id)),
      transitions: stepTransitionRecord,
      isAccept,
      isNew: true,
    });
  }

  const dfa: AutomatonDefinition = {
    type: 'DFA',
    alphabet,
    states: dfaStates,
    transitions: dfaTransitions,
    startStateId: startDfaName,
    acceptStateIds: dfaStates.filter((s) => s.isAccept).map((s) => s.id),
  };

  return { dfa, steps };
}

// -------------------------------------------------------------
// DFA MINIMIZATION (TABLE-FILLING / HOPCROFT)
// -------------------------------------------------------------
export function minimizeDFA(dfa: AutomatonDefinition): {
  minimizedDfa: AutomatonDefinition;
  steps: MinimizationStep[];
  distinguishableMatrix: Record<string, Record<string, boolean>>;
} {
  const states = dfa.states;
  const stateIds = states.map((s) => s.id);
  const alphabet = dfa.alphabet;

  // Step 1: Remove unreachable states
  const reachable = new Set<string>([dfa.startStateId]);
  const q = [dfa.startStateId];
  while (q.length > 0) {
    const curr = q.shift()!;
    for (const t of dfa.transitions) {
      if (t.from === curr && !reachable.has(t.to)) {
        reachable.add(t.to);
        q.push(t.to);
      }
    }
  }

  const activeStates = states.filter((s) => reachable.has(s.id));
  const activeIds = activeStates.map((s) => s.id);

  // Distinguishable table matrix
  const table: Record<string, Record<string, boolean>> = {};
  for (const s1 of activeIds) {
    table[s1] = {};
    for (const s2 of activeIds) {
      table[s1][s2] = false;
    }
  }

  // Base case: Mark pairs (p, q) where one is accept and one is not
  const acceptSet = new Set(dfa.acceptStateIds);
  for (let i = 0; i < activeIds.length; i++) {
    for (let j = i + 1; j < activeIds.length; j++) {
      const p = activeIds[i];
      const q_ = activeIds[j];
      if (acceptSet.has(p) !== acceptSet.has(q_)) {
        table[p][q_] = true;
        table[q_][p] = true;
      }
    }
  }

  const steps: MinimizationStep[] = [];
  steps.push({
    round: 0,
    partitions: [
      activeStates.filter((s) => !acceptSet.has(s.id)).map((s) => s.name),
      activeStates.filter((s) => acceptSet.has(s.id)).map((s) => s.name),
    ],
    distinguishableTable: JSON.parse(JSON.stringify(table)),
    notes: 'Initial partition into Non-Accepting and Accepting states.',
  });

  // Iterative marking
  let changed = true;
  let round = 1;

  while (changed) {
    changed = false;
    for (let i = 0; i < activeIds.length; i++) {
      for (let j = i + 1; j < activeIds.length; j++) {
        const p = activeIds[i];
        const q_ = activeIds[j];

        if (!table[p][q_]) {
          for (const sym of alphabet) {
            const destP = dfa.transitions.find((t) => t.from === p && t.symbols.includes(sym))?.to;
            const destQ = dfa.transitions.find((t) => t.from === q_ && t.symbols.includes(sym))?.to;

            if (destP && destQ && destP !== destQ) {
              if (table[destP][destQ]) {
                table[p][q_] = true;
                table[q_][p] = true;
                changed = true;
                break;
              }
            }
          }
        }
      }
    }

    if (changed) {
      steps.push({
        round,
        partitions: [],
        distinguishableTable: JSON.parse(JSON.stringify(table)),
        notes: `Round ${round}: Marked new distinguishable state pairs based on symbol transitions.`,
      });
      round++;
    }
  }

  // Merge equivalent states
  const visited = new Set<string>();
  const equivalenceGroups: string[][] = [];

  for (const s of activeIds) {
    if (!visited.has(s)) {
      const group = [s];
      visited.add(s);
      for (const other of activeIds) {
        if (!visited.has(other) && !table[s][other]) {
          group.push(other);
          visited.add(other);
        }
      }
      equivalenceGroups.push(group);
    }
  }

  // Build minimized DFA
  const minStates: StateNode[] = [];
  const stateMapping = new Map<string, string>(); // oldId -> newMergedId

  equivalenceGroups.forEach((group, idx) => {
    const newName = group.map((id) => getStateName(dfa, id)).join('/');
    const newId = `M${idx}`;
    group.forEach((oldId) => stateMapping.set(oldId, newId));

    const isStart = group.includes(dfa.startStateId);
    const isAccept = group.some((id) => acceptSet.has(id));

    minStates.push({
      id: newId,
      name: newName,
      x: 120 + (idx % 3) * 180,
      y: 120 + Math.floor(idx / 3) * 150,
      isStart,
      isAccept,
    });
  });

  const minTransitions: TransitionEdge[] = [];
  for (const group of equivalenceGroups) {
    const rep = group[0];
    const fromNew = stateMapping.get(rep)!;

    for (const sym of alphabet) {
      const targetOld = dfa.transitions.find((t) => t.from === rep && t.symbols.includes(sym))?.to;
      if (targetOld && stateMapping.has(targetOld)) {
        const toNew = stateMapping.get(targetOld)!;
        const exist = minTransitions.find((t) => t.from === fromNew && t.to === toNew);
        if (exist) {
          if (!exist.symbols.includes(sym)) exist.symbols.push(sym);
        } else {
          minTransitions.push({
            id: generateId('min_t'),
            from: fromNew,
            to: toNew,
            symbols: [sym],
          });
        }
      }
    }
  }

  const startStateId = stateMapping.get(dfa.startStateId) || minStates[0]?.id || '';
  const acceptStateIds = minStates.filter((s) => s.isAccept).map((s) => s.id);

  const minimizedDfa: AutomatonDefinition = {
    type: 'DFA',
    alphabet,
    states: minStates,
    transitions: minTransitions,
    startStateId,
    acceptStateIds,
  };

  steps.push({
    round: round + 1,
    partitions: equivalenceGroups.map((g) => g.map((id) => getStateName(dfa, id))),
    distinguishableTable: table,
    notes: `Equivalence classes: ${equivalenceGroups.map((g) => `{${g.map((id) => getStateName(dfa, id)).join(',')}}`).join(', ')}`,
  });

  return { minimizedDfa, steps, distinguishableMatrix: table };
}

// -------------------------------------------------------------
// STATE ELIMINATION (DFA -> REGEX)
// -------------------------------------------------------------
export function convertDFAToRegex(dfa: AutomatonDefinition): {
  regex: string;
  steps: StateEliminationStep[];
} {
  const steps: StateEliminationStep[] = [];
  const states = [...dfa.states];
  const stateIds = states.map((s) => s.id);

  // Initialize GNFA with special Start state and Accept state
  const gnfaStart = 'Q_START';
  const gnfaAccept = 'Q_ACCEPT';

  const allNodes = [gnfaStart, ...stateIds, gnfaAccept];
  const R: Record<string, Record<string, string>> = {};

  for (const u of allNodes) {
    R[u] = {};
    for (const v of allNodes) {
      R[u][v] = '∅';
    }
  }

  // Base transitions from DFA
  for (const t of dfa.transitions) {
    const symExpr = t.symbols.join('|');
    if (R[t.from][t.to] === '∅') {
      R[t.from][t.to] = symExpr;
    } else {
      R[t.from][t.to] = `(${R[t.from][t.to]}|${symExpr})`;
    }
  }

  // Start transition
  R[gnfaStart][dfa.startStateId] = 'ε';

  // Accept transitions
  for (const accId of dfa.acceptStateIds) {
    R[accId][gnfaAccept] = 'ε';
  }

  let remaining = [...stateIds];
  let stepCounter = 1;

  steps.push({
    step: 0,
    eliminatedState: 'Initial GNFA setup',
    remainingStates: remaining,
    transitionsRegex: JSON.parse(JSON.stringify(R)),
    explanation: `Added new start state ${gnfaStart} and accept state ${gnfaAccept}.`,
  });

  // Successively eliminate states
  for (const k of stateIds) {
    remaining = remaining.filter((s) => s !== k);
    const activeCurrent = [gnfaStart, ...remaining, gnfaAccept];

    for (const i of activeCurrent) {
      for (const j of activeCurrent) {
        const Rij = R[i][j];
        const Rik = R[i][k];
        const Rkk = R[k][k];
        const Rkj = R[k][j];

        if (Rik !== '∅' && Rkj !== '∅') {
          let bypass = '';
          const rkkStar = Rkk === '∅' || Rkk === 'ε' ? '' : `(${Rkk})*`;
          const left = Rik === 'ε' ? '' : Rik.length > 1 ? `(${Rik})` : Rik;
          const right = Rkj === 'ε' ? '' : Rkj.length > 1 ? `(${Rkj})` : Rkj;

          bypass = `${left}${rkkStar}${right}` || 'ε';

          if (Rij === '∅') {
            R[i][j] = bypass;
          } else if (Rij === 'ε' && bypass === 'ε') {
            R[i][j] = 'ε';
          } else {
            R[i][j] = `(${Rij}|${bypass})`;
          }
        }
      }
    }

    steps.push({
      step: stepCounter++,
      eliminatedState: getStateName(dfa, k),
      remainingStates: remaining,
      transitionsRegex: JSON.parse(JSON.stringify(R)),
      explanation: `Eliminated state ${getStateName(dfa, k)} using rule R_ij = R_ij ∪ (R_ik)(R_kk)*(R_kj)`,
    });
  }

  const rawRegex = R[gnfaStart][gnfaAccept] || '∅';
  const cleanRegex = simplifyRegex(rawRegex);

  return { regex: cleanRegex, steps };
}

function simplifyRegex(expr: string): string {
  return expr
    .replace(/\(ε\)/g, 'ε')
    .replace(/ε\*/g, 'ε')
    .replace(/∅\|/g, '')
    .replace(/\|∅/g, '')
    .replace(/\(∅\)/g, '∅');
}

// -------------------------------------------------------------
// CFG & CYK PARSING ALGORITHM
// -------------------------------------------------------------
export function parseCYKTable(
  grammar: ContextFreeGrammar,
  input: string
): {
  table: string[][][]; // table[length][start] -> array of variables
  accepted: boolean;
  steps: string[];
} {
  const n = input.length;
  if (n === 0) {
    const isNullable = grammar.rules.some(
      (r) => r.left === grammar.startVariable && (r.right.includes('ε') || r.right.includes(''))
    );
    return {
      table: [],
      accepted: isNullable,
      steps: [isNullable ? 'Empty string ε accepted by nullable start variable.' : 'Empty string rejected.'],
    };
  }

  // CYK dynamic programming table: table[len - 1][i] = set of variables generating input[i ... i + len - 1]
  const table: Set<string>[][] = [];
  for (let l = 1; l <= n; l++) {
    table[l - 1] = [];
    for (let s = 0; s <= n - l; s++) {
      table[l - 1][s] = new Set<string>();
    }
  }

  const steps: string[] = [];

  // Base case: length 1 substrings
  for (let s = 0; s < n; s++) {
    const char = input[s];
    for (const rule of grammar.rules) {
      for (const prod of rule.right) {
        if (prod === char) {
          table[0][s].add(rule.left);
        }
      }
    }
    steps.push(`Base: substring "${char}" at index ${s} produced by {${Array.from(table[0][s]).join(', ')}}`);
  }

  // Inductive step: substrings of length 2 to n
  for (let l = 2; l <= n; l++) {
    for (let s = 0; s <= n - l; s++) {
      for (let p = 1; p <= l - 1; p++) {
        const leftVars = table[p - 1][s];
        const rightVars = table[l - p - 1][s + p];

        for (const B of leftVars) {
          for (const C of rightVars) {
            const targetProd = `${B}${C}`;
            for (const rule of grammar.rules) {
              if (rule.right.includes(targetProd)) {
                table[l - 1][s].add(rule.left);
              }
            }
          }
        }
      }
    }
  }

  const topSet = table[n - 1][0];
  const accepted = topSet.has(grammar.startVariable);

  const formattedTable = table.map((row) => row.map((cell) => Array.from(cell)));

  return {
    table: formattedTable,
    accepted,
    steps,
  };
}
