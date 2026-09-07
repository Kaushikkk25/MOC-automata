// ============================================================================
// AUTOMATA CORE — clean implementations derived directly from formal
// definitions. Every function here is PURE: no module-level mutable state, so
// independent automata (e.g. five separate user inputs) can never leak state
// IDs or counters into one another. Each construction gets its own local
// counter passed down the recursion.
// ============================================================================

import { AutomatonDefinition, StateNode, TransitionEdge } from '../types/automata';

export const EPSILON = 'ε';
export const isEpsilonSymbol = (sym: string) =>
  sym === 'ε' || sym === 'eps' || sym === 'e' || sym === 'λ';

// ============================================================================
// SECTION 1 — REGEX SYNTAX AND PARSING (regex -> AST)
// ============================================================================
// Grammar, encoding standard regex precedence (union loosest, then
// concatenation, then postfix repetition, then atoms):
//
//   union   := concat ('|' concat)*
//   concat  := repeat+                      (concatenation is implicit)
//   repeat  := atom ('*' | '?')*
//   atom    := '(' union ')' | symbol | ε
//
// NOTE ON '+': this project historically treats '+' as a SECOND SPELLING OF
// UNION (an alias for '|'), not as the usual "one or more" postfix operator.
// That is preserved here so existing saved regexes keep their meaning. It does
// mean "a+" is not "one or more a" in this project's syntax.

export type RegexAst =
  | { kind: 'empty' } //  ∅  — matches nothing at all
  | { kind: 'epsilon' } //  ε  — matches only the empty string
  | { kind: 'symbol'; value: string }
  | { kind: 'concat'; left: RegexAst; right: RegexAst }
  | { kind: 'union'; left: RegexAst; right: RegexAst }
  | { kind: 'star'; inner: RegexAst }
  | { kind: 'optional'; inner: RegexAst }; //  R?  ≡  (R|ε)

export class RegexParseError extends Error {}

const REGEX_OPERATORS = new Set(['|', '+', '*', '?', '(', ')']);

/**
 * Recursive-descent parser. Precedence is expressed by the grammar's shape
 * rather than by a precedence table, which removes a whole class of
 * precedence bugs: `parseUnion` can only ever combine results of
 * `parseConcat`, so `a|bc` can only parse as `a | (bc)`, never `(a|b) c`.
 */
export function parseRegex(input: string): RegexAst {
  const src = input.replace(/\s+/g, '');
  let pos = 0;

  const peek = (): string | null => (pos < src.length ? src[pos] : null);
  const consume = (): string => src[pos++];

  function parseUnion(): RegexAst {
    let node = parseConcat();
    while (peek() === '|' || peek() === '+') {
      consume();
      const right = parseConcat();
      node = { kind: 'union', left: node, right };
    }
    return node;
  }

  function parseConcat(): RegexAst {
    // An empty branch (e.g. the right side of "a|") denotes ε, matching the
    // usual convention that concatenation of zero factors is the empty string.
    if (peek() === null || peek() === '|' || peek() === '+' || peek() === ')') {
      return { kind: 'epsilon' };
    }
    let node = parseRepeat();
    while (true) {
      const c = peek();
      if (c === null || c === '|' || c === '+' || c === ')') break;
      const right = parseRepeat();
      node = { kind: 'concat', left: node, right };
    }
    return node;
  }

  function parseRepeat(): RegexAst {
    let node = parseAtom();
    // Postfix operators bind tighter than concatenation and may stack (a**).
    while (peek() === '*' || peek() === '?') {
      const op = consume();
      node = op === '*' ? { kind: 'star', inner: node } : { kind: 'optional', inner: node };
    }
    return node;
  }

  function parseAtom(): RegexAst {
    const c = peek();
    if (c === null) throw new RegexParseError('Unexpected end of regular expression.');
    if (c === '(') {
      consume();
      const inner = parseUnion();
      if (peek() !== ')') throw new RegexParseError("Missing closing ')'.");
      consume();
      return inner;
    }
    if (c === ')') throw new RegexParseError("Unexpected ')'.");
    if (c === '*' || c === '?') {
      throw new RegexParseError(`Operator '${c}' has nothing to repeat.`);
    }
    consume();
    if (isEpsilonSymbol(c)) return { kind: 'epsilon' };
    return { kind: 'symbol', value: c };
  }

  const ast = parseUnion();
  if (pos < src.length) throw new RegexParseError(`Unexpected character '${src[pos]}'.`);
  return ast;
}

/** Collects the input alphabet actually referenced by a parsed regex. */
export function alphabetOfAst(ast: RegexAst): string[] {
  const out = new Set<string>();
  const walk = (n: RegexAst): void => {
    switch (n.kind) {
      case 'symbol':
        out.add(n.value);
        break;
      case 'concat':
      case 'union':
        walk(n.left);
        walk(n.right);
        break;
      case 'star':
      case 'optional':
        walk(n.inner);
        break;
      default:
        break;
    }
  };
  walk(ast);
  return Array.from(out).sort();
}

// ============================================================================
// SECTION 2 — THOMPSON CONSTRUCTION (regex AST -> ε-NFA)
// ============================================================================
// Each recursive call returns a FRAGMENT with exactly one start state and
// exactly one accept state, and never mutates any fragment it was given —
// sub-fragments are only ever wired together by ADDING new ε-transitions.
// That invariant ("one in, one out, never rewire the inside") is what makes
// the inductive composition sound.

interface Fragment {
  start: string;
  accept: string;
  states: StateNode[];
  transitions: TransitionEdge[];
}

/**
 * Builds the ε-NFA for a regex AST. `nextId` is a local counter object, not a
 * module-level variable, so two independent conversions can never interfere.
 */
function thompsonFragment(ast: RegexAst, ctr: { n: number }): Fragment {
  const newState = (): StateNode => {
    const id = `q${ctr.n++}`;
    return { id, name: id, x: 0, y: 0 };
  };
  const edge = (from: string, to: string, symbols: string[]): TransitionEdge => ({
    id: `t${ctr.n++}`,
    from,
    to,
    symbols,
  });

  switch (ast.kind) {
    // ∅: a start and accept state with NO path between them, so the fragment
    // accepts nothing. (Reachable only if a caller builds ∅ directly.)
    case 'empty': {
      const s = newState();
      const f = newState();
      return { start: s.id, accept: f.id, states: [s, f], transitions: [] };
    }

    // ε: start --ε--> accept
    case 'epsilon': {
      const s = newState();
      const f = newState();
      return {
        start: s.id,
        accept: f.id,
        states: [s, f],
        transitions: [edge(s.id, f.id, [EPSILON])],
      };
    }

    // symbol a: start --a--> accept
    case 'symbol': {
      const s = newState();
      const f = newState();
      return {
        start: s.id,
        accept: f.id,
        states: [s, f],
        transitions: [edge(s.id, f.id, [ast.value])],
      };
    }

    // Concatenation R.S: link R's accept to S's start with ε. The combined
    // fragment starts where R starts and accepts where S accepts.
    case 'concat': {
      const l = thompsonFragment(ast.left, ctr);
      const r = thompsonFragment(ast.right, ctr);
      return {
        start: l.start,
        accept: r.accept,
        states: [...l.states, ...r.states],
        transitions: [...l.transitions, ...r.transitions, edge(l.accept, r.start, [EPSILON])],
      };
    }

    // Union R|S: a fresh start ε-branches into both fragments, and both
    // fragments' accepts ε-join into a fresh accept. Fresh states are required
    // (rather than reusing R's start) so that the star construction can later
    // loop around this fragment without creating spurious paths.
    case 'union': {
      const l = thompsonFragment(ast.left, ctr);
      const r = thompsonFragment(ast.right, ctr);
      const s = newState();
      const f = newState();
      return {
        start: s.id,
        accept: f.id,
        states: [s, ...l.states, ...r.states, f],
        transitions: [
          ...l.transitions,
          ...r.transitions,
          edge(s.id, l.start, [EPSILON]),
          edge(s.id, r.start, [EPSILON]),
          edge(l.accept, f.id, [EPSILON]),
          edge(r.accept, f.id, [EPSILON]),
        ],
      };
    }

    // Kleene star R*: four ε-edges give exactly the four choices —
    //   start->accept   : zero repetitions
    //   start->R.start  : enter a repetition
    //   R.accept->R.start: repeat again
    //   R.accept->accept: stop repeating
    case 'star': {
      const inner = thompsonFragment(ast.inner, ctr);
      const s = newState();
      const f = newState();
      return {
        start: s.id,
        accept: f.id,
        states: [s, ...inner.states, f],
        transitions: [
          ...inner.transitions,
          edge(s.id, inner.start, [EPSILON]),
          edge(s.id, f.id, [EPSILON]),
          edge(inner.accept, inner.start, [EPSILON]),
          edge(inner.accept, f.id, [EPSILON]),
        ],
      };
    }

    // Optional R?  ≡  (R | ε): like star but WITHOUT the repeat edge.
    case 'optional': {
      const inner = thompsonFragment(ast.inner, ctr);
      const s = newState();
      const f = newState();
      return {
        start: s.id,
        accept: f.id,
        states: [s, ...inner.states, f],
        transitions: [
          ...inner.transitions,
          edge(s.id, inner.start, [EPSILON]),
          edge(s.id, f.id, [EPSILON]),
          edge(inner.accept, f.id, [EPSILON]),
        ],
      };
    }
  }
}

/** Regex string -> ε-NFA. Throws RegexParseError on malformed input. */
export function regexToNfa(regex: string): AutomatonDefinition {
  const trimmed = regex.replace(/\s+/g, '');
  const ast: RegexAst = trimmed === '' ? { kind: 'epsilon' } : parseRegex(trimmed);
  const ctr = { n: 0 };
  const frag = thompsonFragment(ast, ctr);

  // Rename the sequential ids to a clean q0..qN and mark start/accept. Ids are
  // rewritten (not reused from the counter) because the counter is shared with
  // transition ids above.
  const idMap = new Map<string, string>();
  frag.states.forEach((s, i) => idMap.set(s.id, `q${i}`));

  const states: StateNode[] = frag.states.map((s) => ({
    id: idMap.get(s.id)!,
    name: idMap.get(s.id)!,
    x: 0,
    y: 0,
    isStart: s.id === frag.start,
    isAccept: s.id === frag.accept,
  }));

  const transitions: TransitionEdge[] = frag.transitions.map((t, i) => ({
    id: `t${i}`,
    from: idMap.get(t.from)!,
    to: idMap.get(t.to)!,
    symbols: [...t.symbols],
  }));

  return {
    type: 'ENFA',
    alphabet: alphabetOfAst(ast),
    states,
    transitions,
    startStateId: idMap.get(frag.start)!,
    acceptStateIds: [idMap.get(frag.accept)!],
  };
}

// ============================================================================
// SECTION 3 — SUBSET CONSTRUCTION (NFA -> DFA)
// ============================================================================

/**
 * ε-closure: repeatedly add every state reachable by an ε-transition from a
 * state already in the set, until a fixed point is reached. The `seen` guard
 * is what makes this terminate on ε-CYCLES — a state already in the closure is
 * never queued a second time.
 */
export function epsilonClosure(stateIds: string[], transitions: TransitionEdge[]): string[] {
  const closure = new Set<string>(stateIds);
  const stack = [...stateIds];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const t of transitions) {
      if (t.from !== cur) continue;
      if (!t.symbols.some(isEpsilonSymbol)) continue;
      if (!closure.has(t.to)) {
        closure.add(t.to);
        stack.push(t.to);
      }
    }
  }
  return Array.from(closure);
}

/** move(S, a): every state reachable from any state of S on exactly symbol a. */
export function moveOn(
  stateIds: string[],
  transitions: TransitionEdge[],
  symbol: string
): string[] {
  const out = new Set<string>();
  for (const id of stateIds) {
    for (const t of transitions) {
      if (t.from === id && t.symbols.includes(symbol)) out.add(t.to);
    }
  }
  return Array.from(out);
}

/**
 * Canonical key for a SET of NFA states. Sorting before joining is what makes
 * {A,B} and {B,A} the same DFA state: without it, discovery order would decide
 * identity and the same subset could be created twice.
 */
function subsetKey(stateIds: string[]): string {
  return [...new Set(stateIds)].sort().join(',');
}

export interface SubsetStepInfo {
  dfaStateName: string;
  nfaStateIds: string[];
  isAccept: boolean;
  isStart: boolean;
  moves: Record<string, { targetDfaState: string | null; targetNfaIds: string[] }>;
}

/**
 * Subset construction. Worklist algorithm: start from ε-closure of the NFA
 * start state, and for each unprocessed subset and each input symbol compute
 * ε-closure(move(S,a)). Because the destination subset is a single well-defined
 * set, each (state, symbol) pair yields AT MOST ONE destination — determinism
 * is guaranteed by construction, not checked afterwards.
 *
 * The empty destination set is treated as "no transition" (an incomplete DFA)
 * rather than materialising an explicit dead state, matching how this project
 * simulates automata (a missing transition means reject).
 */
export function nfaToDfa(nfa: AutomatonDefinition): {
  dfa: AutomatonDefinition;
  steps: SubsetStepInfo[];
} {
  // ε is a structural marker, never an input symbol of the DFA.
  const alphabet = nfa.alphabet.filter((s) => !isEpsilonSymbol(s));

  const startSubset = epsilonClosure([nfa.startStateId], nfa.transitions);

  const keyToName = new Map<string, string>();
  const keyToSubset = new Map<string, string[]>();
  let nameCounter = 0;
  const nameFor = (subset: string[]): string => {
    const key = subsetKey(subset);
    if (!keyToName.has(key)) {
      // A, B, ... Z, then A1, B1, ... so large DFAs still get unique names.
      const i = nameCounter++;
      const letter = String.fromCharCode(65 + (i % 26));
      const suffix = i >= 26 ? String(Math.floor(i / 26)) : '';
      keyToName.set(key, letter + suffix);
      keyToSubset.set(key, [...new Set(subset)].sort());
    }
    return keyToName.get(key)!;
  };

  const startName = nameFor(startSubset);
  const processed = new Set<string>();
  const worklist: string[][] = [startSubset];

  const dfaStates: StateNode[] = [];
  const dfaTransitions: TransitionEdge[] = [];
  const steps: SubsetStepInfo[] = [];
  let edgeCounter = 0;

  while (worklist.length > 0) {
    const subset = worklist.shift()!;
    const key = subsetKey(subset);
    if (processed.has(key)) continue;
    processed.add(key);

    const name = nameFor(subset);
    const isAccept = subset.some((id) => nfa.acceptStateIds.includes(id));
    const isStart = key === subsetKey(startSubset);

    dfaStates.push({ id: name, name, x: 0, y: 0, isStart, isAccept });

    const moves: SubsetStepInfo['moves'] = {};

    for (const sym of alphabet) {
      const target = epsilonClosure(moveOn(subset, nfa.transitions, sym), nfa.transitions);

      if (target.length === 0) {
        moves[sym] = { targetDfaState: null, targetNfaIds: [] };
        continue;
      }

      const targetName = nameFor(target);
      moves[sym] = { targetDfaState: targetName, targetNfaIds: [...target].sort() };

      // Merge symbols onto an existing edge when two symbols share a
      // destination — purely a rendering convenience; each symbol still has
      // exactly one destination.
      const existing = dfaTransitions.find((t) => t.from === name && t.to === targetName);
      if (existing) {
        if (!existing.symbols.includes(sym)) existing.symbols.push(sym);
      } else {
        dfaTransitions.push({
          id: `d${edgeCounter++}`,
          from: name,
          to: targetName,
          symbols: [sym],
        });
      }

      if (!processed.has(subsetKey(target))) worklist.push(target);
    }

    steps.push({
      dfaStateName: name,
      nfaStateIds: [...subset].sort(),
      isAccept,
      isStart,
      moves,
    });
  }

  return {
    dfa: {
      type: 'DFA',
      alphabet,
      states: dfaStates,
      transitions: dfaTransitions,
      startStateId: startName,
      acceptStateIds: dfaStates.filter((s) => s.isAccept).map((s) => s.id),
    },
    steps,
  };
}

// ============================================================================
// SECTION 4 — DETERMINISM VALIDATION
// ============================================================================

export interface DeterminismViolation {
  stateId: string;
  symbol: string;
  targets: string[];
}

/**
 * A DFA requires δ(q,a) to name at most one state, and forbids ε-transitions.
 * Returns the first violation found, with enough detail to point at it in the
 * UI, or null if the automaton really is deterministic.
 */
export function findDeterminismViolation(
  a: AutomatonDefinition
): DeterminismViolation | null {
  for (const t of a.transitions) {
    if (t.symbols.some(isEpsilonSymbol)) {
      return { stateId: t.from, symbol: EPSILON, targets: [t.to] };
    }
  }
  const targets = new Map<string, Set<string>>();
  for (const t of a.transitions) {
    for (const sym of t.symbols) {
      const k = `${t.from}\u0000${sym}`;
      if (!targets.has(k)) targets.set(k, new Set());
      targets.get(k)!.add(t.to);
    }
  }
  for (const [k, set] of targets) {
    if (set.size > 1) {
      const [stateId, symbol] = k.split('\u0000');
      return { stateId, symbol, targets: Array.from(set) };
    }
  }
  return null;
}

export const isDeterministic = (a: AutomatonDefinition): boolean =>
  findDeterminismViolation(a) === null;

// ============================================================================
// SECTION 5 — DFA MINIMIZATION (partition refinement / Moore)
// ============================================================================

export interface RefinementRound {
  round: number;
  partitions: string[][]; // state NAMES, for display
  note: string;
}

const TRAP = '\u0000TRAP';

/**
 * Minimizes a DFA by partition refinement.
 *
 * Step 1  drop states unreachable from the start (they cannot affect the
 *         language, and including them can only inflate the result).
 * Step 1b complete the transition function with an implicit non-accepting trap
 *         state. This matters: in an INCOMPLETE DFA two states that both lack
 *         a transition on some symbol are NOT thereby equivalent — the trap
 *         makes "no transition" an explicit, comparable destination so the
 *         refinement cannot merge them by accident.
 * Step 2  initial partition = {accepting} / {non-accepting}: distinguishable by
 *         ε itself.
 * Step 3  refine: two states stay together only while, for EVERY symbol, their
 *         destinations lie in the same block. Splitting by that signature is
 *         repeated to a fixed point (Moore's algorithm).
 * Step 4-7 build one state per final block, wire transitions between blocks,
 *         map the start state, and mark a block accepting iff it contains an
 *         accepting state.
 *
 * `violation` is reported rather than silently minimizing a non-DFA.
 */
export function minimizeDfa(dfa: AutomatonDefinition): {
  minimizedDfa: AutomatonDefinition;
  rounds: RefinementRound[];
  equivalenceClasses: string[][]; // state NAMES per class
  violation: DeterminismViolation | null;
} {
  const violation = findDeterminismViolation(dfa);
  const alphabet = dfa.alphabet.filter((s) => !isEpsilonSymbol(s));
  const nameOf = (id: string) => dfa.states.find((s) => s.id === id)?.name ?? id;

  // --- Step 1: reachability ------------------------------------------------
  const reachable = new Set<string>([dfa.startStateId]);
  const stack = [dfa.startStateId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const t of dfa.transitions) {
      if (t.from === cur && !reachable.has(t.to)) {
        reachable.add(t.to);
        stack.push(t.to);
      }
    }
  }
  const liveIds = dfa.states.filter((s) => reachable.has(s.id)).map((s) => s.id);

  // --- Step 1b: total transition function via an implicit trap -------------
  const delta = (from: string, sym: string): string => {
    if (from === TRAP) return TRAP;
    const t = dfa.transitions.find((tr) => tr.from === from && tr.symbols.includes(sym));
    return t ? t.to : TRAP;
  };
  const working = [...liveIds, TRAP];
  const acceptSet = new Set(dfa.acceptStateIds);
  const isAccepting = (id: string) => id !== TRAP && acceptSet.has(id);

  // --- Step 2: initial partition -------------------------------------------
  let blockOf = new Map<string, number>();
  for (const id of working) blockOf.set(id, isAccepting(id) ? 1 : 0);

  const rounds: RefinementRound[] = [];
  const describe = (map: Map<string, number>): string[][] => {
    const byBlock = new Map<number, string[]>();
    for (const id of working) {
      if (id === TRAP) continue; // the trap is internal scaffolding, not a real state
      const b = map.get(id)!;
      if (!byBlock.has(b)) byBlock.set(b, []);
      byBlock.get(b)!.push(nameOf(id));
    }
    return Array.from(byBlock.values());
  };

  rounds.push({
    round: 0,
    partitions: describe(blockOf),
    note: 'Initial partition: accepting states separated from non-accepting states.',
  });

  // --- Step 3: refine to a fixed point -------------------------------------
  let round = 1;
  while (true) {
    // Signature = own block plus the block of each symbol's destination. Two
    // states may only remain together if their whole signature agrees.
    const signature = new Map<string, string>();
    for (const id of working) {
      const parts = [String(blockOf.get(id))];
      for (const sym of alphabet) parts.push(String(blockOf.get(delta(id, sym))));
      signature.set(id, parts.join('|'));
    }

    const sigToBlock = new Map<string, number>();
    const next = new Map<string, number>();
    for (const id of working) {
      const sig = signature.get(id)!;
      if (!sigToBlock.has(sig)) sigToBlock.set(sig, sigToBlock.size);
      next.set(id, sigToBlock.get(sig)!);
    }

    const changed = sigToBlock.size !== new Set(blockOf.values()).size;
    blockOf = next;
    if (!changed) break;

    rounds.push({
      round,
      partitions: describe(blockOf),
      note: `Round ${round}: split blocks whose members disagree on the destination block of some symbol.`,
    });
    round++;
  }

  // --- Step 4: one state per block (excluding a purely-dead trap block) ----
  const blockMembers = new Map<number, string[]>();
  for (const id of working) {
    const b = blockOf.get(id)!;
    if (!blockMembers.has(b)) blockMembers.set(b, []);
    blockMembers.get(b)!.push(id);
  }

  // The trap's block is dropped from the output so the result stays an
  // incomplete DFA in the same style as the input (a missing transition means
  // reject). Real states that happen to be equivalent to the trap are dead
  // states and are dropped with it — this preserves the language.
  const trapBlock = blockOf.get(TRAP)!;

  const outBlocks = Array.from(blockMembers.entries())
    .filter(([b]) => b !== trapBlock)
    .sort((x, y) => x[0] - y[0]);

  const blockToNewId = new Map<number, string>();
  const minStates: StateNode[] = outBlocks.map(([b, members], i) => {
    const id = `M${i}`;
    blockToNewId.set(b, id);
    return {
      id,
      name: members.map(nameOf).sort().join('/'),
      x: 0,
      y: 0,
      isStart: members.includes(dfa.startStateId),
      isAccept: members.some((m) => isAccepting(m)),
    };
  });

  // --- Step 5: transitions between blocks ----------------------------------
  const minTransitions: TransitionEdge[] = [];
  let e = 0;
  for (const [b, members] of outBlocks) {
    const rep = members[0]; // every member behaves identically by construction
    const from = blockToNewId.get(b)!;
    for (const sym of alphabet) {
      const destBlock = blockOf.get(delta(rep, sym))!;
      if (destBlock === trapBlock) continue; // dropped: means reject
      const to = blockToNewId.get(destBlock)!;
      const existing = minTransitions.find((t) => t.from === from && t.to === to);
      if (existing) {
        if (!existing.symbols.includes(sym)) existing.symbols.push(sym);
      } else {
        minTransitions.push({ id: `m${e++}`, from, to, symbols: [sym] });
      }
    }
  }

  // --- Steps 6 & 7: start mapping and accepting marking --------------------
  const startBlock = blockOf.get(dfa.startStateId);
  const startStateId =
    startBlock !== undefined && blockToNewId.has(startBlock)
      ? blockToNewId.get(startBlock)!
      : minStates[0]?.id ?? '';

  return {
    minimizedDfa: {
      type: 'DFA',
      alphabet,
      states: minStates,
      transitions: minTransitions,
      startStateId,
      acceptStateIds: minStates.filter((s) => s.isAccept).map((s) => s.id),
    },
    rounds,
    equivalenceClasses: outBlocks.map(([, members]) => members.map(nameOf)),
    violation,
  };
}

// ============================================================================
// SECTION 6 — STATE ELIMINATION (DFA/NFA -> regex)
// ============================================================================
// Expressions are built as an AST, never by pasting strings together. Building
// structurally is what guarantees correct precedence: parentheses are decided
// once, at serialization time, from each node's precedence relative to its
// parent — so `ab|c` can never be emitted where `a(b|c)` was meant.

type Rx = RegexAst;
const RX_EMPTY: Rx = { kind: 'empty' };
const RX_EPSILON: Rx = { kind: 'epsilon' };

/** Structural key, used only to detect and drop duplicate union branches. */
function rxKey(n: Rx): string {
  switch (n.kind) {
    case 'empty':
      return '0';
    case 'epsilon':
      return '1';
    case 'symbol':
      return `s:${n.value}`;
    case 'star':
      return `*(${rxKey(n.inner)})`;
    case 'optional':
      return `?(${rxKey(n.inner)})`;
    case 'concat':
      return `.(${rxKey(n.left)},${rxKey(n.right)})`;
    case 'union': {
      // Union is commutative, so sort branch keys to recognise R|S and S|R.
      const parts = [rxKey(n.left), rxKey(n.right)].sort();
      return `|(${parts.join(',')})`;
    }
  }
}

/** R|S with the identities ∅|R = R and R|R = R applied. */
function rxUnion(a: Rx, b: Rx): Rx {
  if (a.kind === 'empty') return b;
  if (b.kind === 'empty') return a;
  if (rxKey(a) === rxKey(b)) return a;
  return { kind: 'union', left: a, right: b };
}

/** RS with the identities εR = R, Rε = R and ∅R = R∅ = ∅ applied. */
function rxConcat(a: Rx, b: Rx): Rx {
  if (a.kind === 'empty' || b.kind === 'empty') return RX_EMPTY;
  if (a.kind === 'epsilon') return b;
  if (b.kind === 'epsilon') return a;
  return { kind: 'concat', left: a, right: b };
}

/** R* with the identities ∅* = ε, ε* = ε and (R*)* = R* applied. */
function rxStar(a: Rx): Rx {
  if (a.kind === 'empty' || a.kind === 'epsilon') return RX_EPSILON;
  if (a.kind === 'star') return a;
  return { kind: 'star', inner: a };
}

function rxPrecedence(n: Rx): number {
  switch (n.kind) {
    case 'union':
      return 1;
    case 'concat':
      return 2;
    case 'star':
    case 'optional':
      return 3;
    default:
      return 4;
  }
}

/** Serializes an expression, parenthesising only where precedence demands it. */
export function serializeRegex(n: Rx, minPrec = 0): string {
  let s: string;
  switch (n.kind) {
    case 'empty':
      s = '∅';
      break;
    case 'epsilon':
      s = EPSILON;
      break;
    case 'symbol':
      s = n.value;
      break;
    case 'star':
      s = `${serializeRegex(n.inner, 3)}*`;
      break;
    case 'optional':
      s = `${serializeRegex(n.inner, 3)}?`;
      break;
    case 'concat':
      s = `${serializeRegex(n.left, 2)}${serializeRegex(n.right, 2)}`;
      break;
    case 'union':
      s = `${serializeRegex(n.left, 1)}|${serializeRegex(n.right, 1)}`;
      break;
  }
  return rxPrecedence(n) < minPrec ? `(${s})` : s;
}

export interface EliminationStep {
  step: number;
  eliminatedState: string;
  remainingStates: string[];
  snapshot: Record<string, Record<string, string>>;
  explanation: string;
}

/**
 * Converts an automaton to a regex by GNFA state elimination.
 *
 * A fresh start node (ε into the old start) and a fresh accept node (ε from
 * every old accepting state) are added first. These guarantee the invariants
 * the elimination step relies on: the start node has no incoming edges and the
 * accept node has no outgoing edges, so neither is ever eliminated and
 * multiple accepting states are handled uniformly.
 *
 * Eliminating state k rewires every remaining pair (i,j) by
 *     R_ij := R_ij ∪ R_ik (R_kk)* R_kj
 * i.e. "keep what you had, or detour through k, looping on k as often as you
 * like". When no ordinary states remain, R[start][accept] is the answer.
 */
export function dfaToRegex(dfa: AutomatonDefinition): {
  regex: string;
  steps: EliminationStep[];
} {
  const START = '\u0000S';
  const ACCEPT = '\u0000A';
  const ids = dfa.states.map((s) => s.id);
  const nodes = [START, ...ids, ACCEPT];
  const nameOf = (id: string) => dfa.states.find((s) => s.id === id)?.name ?? id;

  const R = new Map<string, Map<string, Rx>>();
  for (const u of nodes) {
    const row = new Map<string, Rx>();
    for (const v of nodes) row.set(v, RX_EMPTY);
    R.set(u, row);
  }
  const get = (u: string, v: string): Rx => R.get(u)!.get(v)!;
  const set = (u: string, v: string, x: Rx) => R.get(u)!.set(v, x);

  // Parallel edges and multi-symbol edges become unions.
  for (const t of dfa.transitions) {
    const symbolExpr = t.symbols
      .map((sym): Rx => (isEpsilonSymbol(sym) ? RX_EPSILON : { kind: 'symbol', value: sym }))
      .reduce(rxUnion, RX_EMPTY);
    set(t.from, t.to, rxUnion(get(t.from, t.to), symbolExpr));
  }
  set(START, dfa.startStateId, rxUnion(get(START, dfa.startStateId), RX_EPSILON));
  for (const acc of dfa.acceptStateIds) {
    set(acc, ACCEPT, rxUnion(get(acc, ACCEPT), RX_EPSILON));
  }

  const snapshot = (): Record<string, Record<string, string>> => {
    const out: Record<string, Record<string, string>> = {};
    for (const u of nodes) {
      const label = u === START ? 'Q_START' : u === ACCEPT ? 'Q_ACCEPT' : nameOf(u);
      out[label] = {};
      for (const v of nodes) {
        const vl = v === START ? 'Q_START' : v === ACCEPT ? 'Q_ACCEPT' : nameOf(v);
        out[label][vl] = serializeRegex(get(u, v));
      }
    }
    return out;
  };

  const steps: EliminationStep[] = [];
  let remaining = [...ids];

  steps.push({
    step: 0,
    eliminatedState: 'Initial GNFA setup',
    remainingStates: remaining.map(nameOf),
    snapshot: snapshot(),
    explanation:
      'Added a new start state (ε into the original start) and a new accept state (ε from every accepting state).',
  });

  let stepNo = 1;
  for (const k of ids) {
    remaining = remaining.filter((s) => s !== k);
    const active = [START, ...remaining, ACCEPT];
    const loop = rxStar(get(k, k));

    // Snapshot the k-row/column before mutating, so every pair is rewired
    // using the values as they were at the start of this elimination.
    const inTo = new Map<string, Rx>();
    const outFrom = new Map<string, Rx>();
    for (const x of active) {
      inTo.set(x, get(x, k));
      outFrom.set(x, get(k, x));
    }

    for (const i of active) {
      const ik = inTo.get(i)!;
      if (ik.kind === 'empty') continue;
      for (const j of active) {
        const kj = outFrom.get(j)!;
        if (kj.kind === 'empty') continue;
        set(i, j, rxUnion(get(i, j), rxConcat(rxConcat(ik, loop), kj)));
      }
    }

    steps.push({
      step: stepNo++,
      eliminatedState: nameOf(k),
      remainingStates: remaining.map(nameOf),
      snapshot: snapshot(),
      explanation: `Eliminated state ${nameOf(k)} by rewiring every remaining pair with R_ij := R_ij ∪ R_ik (R_kk)* R_kj.`,
    });
  }

  return { regex: serializeRegex(get(START, ACCEPT)), steps };
}