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
  ThompsonConstructionStep,
} from '../types/automata';
import * as core from './automataCore';

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
// EQUIVALENCE CHECKING (two automata, shortest counterexample)
// -------------------------------------------------------------
function stepStateSet(
  states: string[],
  transitions: TransitionEdge[],
  symbol: string,
  useEpsilonClosure: boolean
): string[] {
  const nextSet = new Set<string>();
  for (const stId of states) {
    for (const t of transitions) {
      if (t.from === stId && t.symbols.includes(symbol)) nextSet.add(t.to);
    }
  }
  let next = Array.from(nextSet);
  if (useEpsilonClosure) next = getEpsilonClosure(next, transitions);
  return next;
}

const isAcceptingSet = (stateSet: string[], acceptIds: string[]) =>
  stateSet.some((id) => acceptIds.includes(id));

export function checkAutomataEquivalence(
  a: AutomatonDefinition,
  b: AutomatonDefinition,
  maxLength: number = 12
): {
  equivalent: boolean;
  counterexample: string | null;
  acceptedByA: boolean;
  acceptedByB: boolean;
} {
  const alphabet = Array.from(new Set([...a.alphabet, ...b.alphabet]));
  const aUsesEps = a.type === 'NFA' || a.type === 'ENFA';
  const bUsesEps = b.type === 'NFA' || b.type === 'ENFA';

  const startA = aUsesEps ? getEpsilonClosure([a.startStateId], a.transitions) : [a.startStateId];
  const startB = bUsesEps ? getEpsilonClosure([b.startStateId], b.transitions) : [b.startStateId];

  const startAccA = isAcceptingSet(startA, a.acceptStateIds);
  const startAccB = isAcceptingSet(startB, b.acceptStateIds);
  if (startAccA !== startAccB) {
    return { equivalent: false, counterexample: '', acceptedByA: startAccA, acceptedByB: startAccB };
  }

  const key = (s1: string[], s2: string[]) => `${[...s1].sort().join(',')}|${[...s2].sort().join(',')}`;
  const visited = new Set<string>([key(startA, startB)]);
  const queue: Array<{ aSet: string[]; bSet: string[]; str: string }> = [
    { aSet: startA, bSet: startB, str: '' },
  ];

  while (queue.length > 0) {
    const { aSet, bSet, str } = queue.shift()!;
    if (str.length >= maxLength) continue;

    for (const sym of alphabet) {
      const nextA = stepStateSet(aSet, a.transitions, sym, aUsesEps);
      const nextB = stepStateSet(bSet, b.transitions, sym, bUsesEps);
      const k = key(nextA, nextB);
      if (visited.has(k)) continue;
      visited.add(k);

      const accA = isAcceptingSet(nextA, a.acceptStateIds);
      const accB = isAcceptingSet(nextB, b.acceptStateIds);
      const nextStr = str + sym;

      if (accA !== accB) {
        return { equivalent: false, counterexample: nextStr, acceptedByA: accA, acceptedByB: accB };
      }

      queue.push({ aSet: nextA, bSet: nextB, str: nextStr });
    }
  }

  return { equivalent: true, counterexample: null, acceptedByA: false, acceptedByB: false };
}

// Enumerate short strings over an automaton's alphabet and pick a
// representative, mostly-short sample of accepted/rejected ones — used
// wherever we need a quick illustrative test set for a given automaton
// (e.g. verifying a conversion, generating a practice question).
export function generateSampleTestStrings(
  automaton: AutomatonDefinition,
  maxCases: number = 8
): Array<{ input: string; expected: boolean }> {
  const alphabet = automaton.alphabet;
  if (alphabet.length === 0) {
    return [{ input: '', expected: testAutomatonInput(automaton, '') }];
  }

  const maxLen = alphabet.length <= 2 ? 6 : alphabet.length === 3 ? 4 : 3;
  const candidates: string[] = [''];
  let frontier = [''];
  for (let len = 1; len <= maxLen; len++) {
    const next: string[] = [];
    for (const s of frontier) for (const sym of alphabet) next.push(s + sym);
    candidates.push(...next);
    frontier = next;
  }

  const accepted = candidates.filter((s) => testAutomatonInput(automaton, s));
  const rejected = candidates.filter((s) => !testAutomatonInput(automaton, s));

  const picked: string[] = [];
  let i = 0;
  let j = 0;
  while (picked.length < maxCases && (i < accepted.length || j < rejected.length)) {
    if (i < accepted.length) picked.push(accepted[i++]);
    if (picked.length < maxCases && j < rejected.length) picked.push(rejected[j++]);
  }

  return picked
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .map((s) => ({ input: s, expected: testAutomatonInput(automaton, s) }));
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
// ALGORITHM ADAPTERS
// -------------------------------------------------------------
// The four core algorithms now live in ./automataCore, implemented directly
// from their formal definitions with no module-level mutable state. The
// functions below are thin adapters: they call the core, apply visual layout,
// and reshape the results into the step/report structures the existing UI
// already renders. No algorithmic decisions are made here.

function layoutNFAStates(states: StateNode[], transitions: TransitionEdge[], startStateId: string) {
  const spacingX = 160;
  const spacingY = 110;

  // BFS from the start state assigns each state a "level" — its shortest
  // distance from start. Placing states by level (left-to-right) instead of by
  // internal creation order is what makes these diagrams readable: the graph is
  // equally correct either way, but creation order has nothing to do with
  // visual flow, so a naive grid makes edges crisscross confusingly.
  const levelOf = new Map<string, number>();
  const queue: string[] = [startStateId];
  levelOf.set(startStateId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const level = levelOf.get(current)!;
    for (const t of transitions) {
      if (t.from === current && !levelOf.has(t.to)) {
        levelOf.set(t.to, level + 1);
        queue.push(t.to);
      }
    }
  }

  let maxLevel = 0;
  for (const lvl of levelOf.values()) maxLevel = Math.max(maxLevel, lvl);
  states.forEach((st) => {
    if (!levelOf.has(st.id)) {
      maxLevel += 1;
      levelOf.set(st.id, maxLevel);
    }
  });

  const byLevel = new Map<number, StateNode[]>();
  states.forEach((st) => {
    const lvl = levelOf.get(st.id)!;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(st);
  });

  const maxCountAtAnyLevel = Math.max(1, ...Array.from(byLevel.values()).map((arr) => arr.length));
  const totalHeight = (maxCountAtAnyLevel - 1) * spacingY;

  byLevel.forEach((levelStates, level) => {
    const levelHeight = (levelStates.length - 1) * spacingY;
    const yOffset = (totalHeight - levelHeight) / 2;
    levelStates.forEach((st, idx) => {
      st.x = 80 + level * spacingX;
      st.y = 80 + yOffset + idx * spacingY;
    });
  });
}

// -------------------------------------------------------------
// REGEX -> ε-NFA (Thompson)
// -------------------------------------------------------------
export function convertRegexToNFA(regexStr: string): {
  nfa: AutomatonDefinition;
  steps: ThompsonConstructionStep[];
} {
  const nfa = core.regexToNfa(regexStr);
  layoutNFAStates(nfa.states, nfa.transitions, nfa.startStateId);

  // Walk the parsed AST in the same post-order the construction uses, so the
  // displayed steps mirror how the fragments were actually composed.
  const trimmed = regexStr.replace(/\s+/g, '');
  const ast: core.RegexAst = trimmed === '' ? { kind: 'epsilon' } : core.parseRegex(trimmed);

  const steps: ThompsonConstructionStep[] = [];
  const walk = (n: core.RegexAst): { label: string; states: number; transitions: number } => {
    const push = (
      token: string,
      operation: ThompsonConstructionStep['operation'],
      label: string,
      states: number,
      transitions: number,
      explanation: string
    ) => {
      steps.push({
        step: steps.length + 1,
        token,
        operation,
        resultLabel: label,
        stateCount: states,
        transitionCount: transitions,
        explanation,
      });
      return { label, states, transitions };
    };

    switch (n.kind) {
      case 'empty':
        return push('∅', 'symbol', '∅', 2, 0, 'Built a fragment for the empty language ∅: a start and accept state with no path between them, so nothing is accepted.');
      case 'epsilon':
        return push('ε', 'symbol', 'ε', 2, 1, 'Built a fragment for ε: a start state with a single ε-transition straight to an accepting state.');
      case 'symbol':
        return push(n.value, 'symbol', n.value, 2, 1, `Built a basic fragment for symbol '${n.value}': a new start state with a single transition on '${n.value}' to a new accepting state.`);
      case 'concat': {
        const l = walk(n.left);
        const r = walk(n.right);
        const label = `${l.label}${r.label}`;
        return push('.', 'concat', label, l.states + r.states, l.transitions + r.transitions + 1,
          `Concatenated '${l.label}' and '${r.label}' into '${label}' by adding one ε-transition from '${l.label}''s accepting state to '${r.label}''s start state. The combined fragment starts where '${l.label}' started and accepts where '${r.label}' accepts.`);
      }
      case 'union': {
        const l = walk(n.left);
        const r = walk(n.right);
        const label = `(${l.label}|${r.label})`;
        return push('|', 'union', label, l.states + r.states + 2, l.transitions + r.transitions + 4,
          `Combined '${l.label}' and '${r.label}' into '${label}' using Thompson's union rule: a new start state gets ε-transitions into both fragments' start states, and a new accepting state is reached by ε-transitions from both fragments' accepting states.`);
      }
      case 'star': {
        const inner = walk(n.inner);
        const label = `${inner.label}*`;
        return push('*', 'star', label, inner.states + 2, inner.transitions + 4,
          `Applied the Kleene star to '${inner.label}', producing '${label}'. Added a new start and accept state wired with four ε-transitions: start→accept (zero repetitions), start→'${inner.label}''s start (enter a repetition), '${inner.label}''s accept→its start (repeat again), and '${inner.label}''s accept→accept (stop repeating).`);
      }
      case 'optional': {
        const inner = walk(n.inner);
        const label = `${inner.label}?`;
        return push('?', 'star', label, inner.states + 2, inner.transitions + 3,
          `Made '${inner.label}' optional, producing '${label}'. Like the Kleene star but WITHOUT the repeat edge: start→accept skips it entirely, start→'${inner.label}''s start enters it once, and '${inner.label}''s accept→accept leaves.`);
      }
    }
  };
  walk(ast);

  return { nfa, steps };
}

// -------------------------------------------------------------
// SUBSET / POWERSET CONSTRUCTION (NFA -> DFA)
// -------------------------------------------------------------
export function convertNFAToDFA(nfa: AutomatonDefinition): {
  dfa: AutomatonDefinition;
  steps: SubsetConstructionStep[];
} {
  const { dfa, steps: coreSteps } = core.nfaToDfa(nfa);
  layoutNFAStates(dfa.states, dfa.transitions, dfa.startStateId);

  const alphabet = dfa.alphabet;
  const steps: SubsetConstructionStep[] = coreSteps.map((st, i) => {
    const names = st.nfaStateIds.map((id) => getStateName(nfa, id));
    const subsetLabel = `{${names.join(', ') || '∅'}}`;
    const acceptingMembers = st.nfaStateIds
      .filter((id) => nfa.acceptStateIds.includes(id))
      .map((id) => getStateName(nfa, id));

    let text = st.isStart
      ? `DFA state ${st.dfaStateName} is the start state. It is formed by taking the ε-closure of the NFA's start state, giving the subset ${subsetLabel}. `
      : `DFA state ${st.dfaStateName} represents the subset ${subsetLabel}, reached while processing an earlier transition. `;

    if (st.isAccept) {
      const verb = acceptingMembers.length > 1 ? 'are' : 'is';
      text += `Since ${acceptingMembers.join(', ')} ${verb} an accepting state in the original NFA, DFA state ${st.dfaStateName} is also accepting. `;
    } else {
      text += `None of the NFA states in this subset are accepting, so DFA state ${st.dfaStateName} is not an accepting state. `;
    }

    const transitions: SubsetConstructionStep['transitions'] = {};
    const moves = alphabet.map((sym) => {
      const m = st.moves[sym];
      if (!m || m.targetDfaState === null) {
        transitions[sym] = { targetDfaState: '∅ (Dead State)', targetNfaSet: [] };
        return `on '${sym}' there is no reachable NFA state, so it goes to the dead state`;
      }
      const targetNames = m.targetNfaIds.map((id) => getStateName(nfa, id));
      transitions[sym] = { targetDfaState: m.targetDfaState, targetNfaSet: targetNames };
      return `on '${sym}' it moves to ${m.targetDfaState} (subset {${targetNames.join(', ')}})`;
    });
    text += `From ${st.dfaStateName}: ${moves.join('; ')}.`;

    return {
      step: i + 1,
      dfaStateName: st.dfaStateName,
      nfaStateSet: names,
      transitions,
      isAccept: st.isAccept,
      isNew: true,
      explanation: text,
    };
  });

  return { dfa, steps };
}

// -------------------------------------------------------------
// DETERMINISM VALIDATION
// -------------------------------------------------------------
export function findDeterminismViolation(
  a: AutomatonDefinition
): { stateId: string; symbol: string; targets: string[] } | null {
  return core.findDeterminismViolation(a);
}

export function isAutomatonDeterministic(a: AutomatonDefinition): boolean {
  return core.isDeterministic(a);
}

// -------------------------------------------------------------
// DFA MINIMIZATION (partition refinement)
// -------------------------------------------------------------
export function minimizeDFA(dfa: AutomatonDefinition): {
  minimizedDfa: AutomatonDefinition;
  steps: MinimizationStep[];
  distinguishableMatrix: Record<string, Record<string, boolean>>;
} {
  const { minimizedDfa, rounds, equivalenceClasses, violation } = core.minimizeDfa(dfa);
  layoutNFAStates(minimizedDfa.states, minimizedDfa.transitions, minimizedDfa.startStateId);

  const warning = violation
    ? `⚠ INPUT IS NOT A VALID DFA: state "${getStateName(dfa, violation.stateId)}" has ${
        violation.symbol === 'ε'
          ? 'an ε-transition (only valid for NFA/ENFA, not a DFA)'
          : `multiple transitions on '${violation.symbol}' (to ${violation.targets
              .map((id) => getStateName(dfa, id))
              .join(' AND ')})`
      }. Minimization requires a deterministic DFA, so the result below should not be trusted. `
    : '';

  const steps: MinimizationStep[] = rounds.map((r, i) => ({
    round: r.round,
    partitions: r.partitions,
    distinguishableTable: {},
    notes: i === 0 ? `${warning}${r.note}` : r.note,
  }));

  steps.push({
    round: rounds.length,
    partitions: equivalenceClasses,
    distinguishableTable: {},
    notes: `Final equivalence classes: ${equivalenceClasses
      .map((g) => `{${g.join(',')}}`)
      .join(', ')}. Each class becomes one state of the minimal DFA.`,
  });

  return { minimizedDfa, steps, distinguishableMatrix: {} };
}

// -------------------------------------------------------------
// STATE ELIMINATION (DFA -> REGEX)
// -------------------------------------------------------------
export function convertDFAToRegex(dfa: AutomatonDefinition): {
  regex: string;
  steps: StateEliminationStep[];
} {
  const { regex, steps: coreSteps } = core.dfaToRegex(dfa);
  const steps: StateEliminationStep[] = coreSteps.map((s) => ({
    step: s.step,
    eliminatedState: s.eliminatedState,
    remainingStates: s.remainingStates,
    transitionsRegex: s.snapshot,
    explanation: s.explanation,
  }));
  return { regex, steps };
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