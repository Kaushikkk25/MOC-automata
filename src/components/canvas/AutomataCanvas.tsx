import React, { useState, useRef, useEffect } from 'react';
import { AutomatonDefinition, StateNode, TransitionEdge } from '../../types/automata';
import { generateId, getStateName } from '../../utils/automataEngine';
import { Plus, Trash2, CheckCircle2, Play, ZoomIn, ZoomOut, RotateCcw, Move, Maximize2 } from 'lucide-react';

interface AutomataCanvasProps {
  automaton: AutomatonDefinition;
  onChange: (updated: AutomatonDefinition) => void;
  activeStateIds?: string[];
  readOnly?: boolean;
  highlightTransitions?: string[];
}

export const AutomataCanvas: React.FC<AutomataCanvasProps> = ({
  automaton,
  onChange,
  activeStateIds = [],
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);

  // Dragging state
  const [draggingStateId, setDraggingStateId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Transition creation mode
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  // Zoom & Pan
    // Zoom & Pan
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fit all states into the visible canvas area by computing a bounding box
  // of every state's (x, y) and choosing a zoom/pan that centers it.
  const fitToScreen = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0 || automaton.states.length === 0) return;

    // Padding accounts for state radius, the START arrow (extends ~48px left
    // of the start state), self-loop curves (~50px above a state), and
    // transition label pills.
    const PADDING = 90;
    const xs = automaton.states.map((s) => s.x);
    const ys = automaton.states.map((s) => s.y);
    const minX = Math.min(...xs) - PADDING;
    const maxX = Math.max(...xs) + PADDING;
    const minY = Math.min(...ys) - PADDING;
    const maxY = Math.max(...ys) + PADDING;

    const contentWidth = Math.max(maxX - minX, 1);
    const contentHeight = Math.max(maxY - minY, 1);

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    // Cap at 1.5x so a single tiny automaton doesn't get blown up absurdly;
    // floor at 0.05 so even 60-70 states can shrink to fit.
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.05), 1.5);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setZoom(nextZoom);
    setPan({
      x: rect.width / 2 - cx * nextZoom,
      y: rect.height / 2 - cy * nextZoom,
    });
  };

  // Auto-fit whenever the number of states changes (states added/removed,
  // or a freshly converted/loaded automaton) — not on every drag, since
  // dragging changes x/y but not the count, and we don't want to yank the
  // view out from under someone mid-drag.
  useEffect(() => {
    fitToScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automaton.states.length]);

  // Modal / Inputs for editing transition
  const [editingTransition, setEditingTransition] = useState<TransitionEdge | null>(null);
  const [transitionSymbolsInput, setTransitionSymbolsInput] = useState('');

  // Handle canvas mouse events for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedStateId(null);
      setSelectedTransitionId(null);
      setConnectSourceId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (draggingStateId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = (e.clientX - rect.left - pan.x) / zoom;
        const mouseY = (e.clientY - rect.top - pan.y) / zoom;
        const newX = Math.round(mouseX - dragOffset.x);
        const newY = Math.round(mouseY - dragOffset.y);

        onChange({
          ...automaton,
          states: automaton.states.map((st) =>
            st.id === draggingStateId ? { ...st, x: Math.max(40, newX), y: Math.max(40, newY) } : st
          ),
        });
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingStateId(null);
  };

  // State interaction
  const handleStateMouseDown = (st: StateNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectSourceId) {
      // Create transition from connectSourceId to st.id
      createTransition(connectSourceId, st.id);
      setConnectSourceId(null);
      return;
    }

    if (!readOnly) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = (e.clientX - rect.left - pan.x) / zoom;
        const mouseY = (e.clientY - rect.top - pan.y) / zoom;
        setDraggingStateId(st.id);
        setDragOffset({ x: mouseX - st.x, y: mouseY - st.y });
      }
    }
    setSelectedStateId(st.id);
    setSelectedTransitionId(null);
  };

  const addState = () => {
    const nextIdx = automaton.states.length;
    const newId = `q${nextIdx}`;
    const newState: StateNode = {
      id: newId,
      name: newId,
      x: 100 + (nextIdx % 4) * 140,
      y: 120 + Math.floor(nextIdx / 4) * 120,
      isStart: automaton.states.length === 0,
      isAccept: false,
    };
    onChange({
      ...automaton,
      states: [...automaton.states, newState],
      startStateId: automaton.states.length === 0 ? newId : automaton.startStateId,
    });
  };

  const toggleAcceptState = (stId: string) => {
    const isCurrentlyAccept = automaton.acceptStateIds.includes(stId);
    const newAcceptIds = isCurrentlyAccept
      ? automaton.acceptStateIds.filter((id) => id !== stId)
      : [...automaton.acceptStateIds, stId];

    onChange({
      ...automaton,
      acceptStateIds: newAcceptIds,
      states: automaton.states.map((s) =>
        s.id === stId ? { ...s, isAccept: !isCurrentlyAccept } : s
      ),
    });
  };

  const setStartState = (stId: string) => {
    onChange({
      ...automaton,
      startStateId: stId,
      states: automaton.states.map((s) => ({ ...s, isStart: s.id === stId })),
    });
  };

  const deleteState = (stId: string) => {
    const newStates = automaton.states.filter((s) => s.id !== stId);
    const newTransitions = automaton.transitions.filter((t) => t.from !== stId && t.to !== stId);
    const newAcceptIds = automaton.acceptStateIds.filter((id) => id !== stId);
    const newStart = automaton.startStateId === stId ? (newStates[0]?.id || '') : automaton.startStateId;

    onChange({
      ...automaton,
      states: newStates,
      transitions: newTransitions,
      acceptStateIds: newAcceptIds,
      startStateId: newStart,
    });
    setSelectedStateId(null);
  };

  const createTransition = (fromId: string, toId: string) => {
    const existing = automaton.transitions.find((t) => t.from === fromId && t.to === toId);
    if (existing) {
      setEditingTransition(existing);
      setTransitionSymbolsInput(existing.symbols.join(', '));
      return;
    }

    const defaultSym = automaton.alphabet[0] || '0';
    const newTrans: TransitionEdge = {
      id: generateId('t'),
      from: fromId,
      to: toId,
      symbols: [defaultSym],
    };

    onChange({
      ...automaton,
      transitions: [...automaton.transitions, newTrans],
    });
    setEditingTransition(newTrans);
    setTransitionSymbolsInput(defaultSym);
  };

  const saveTransitionSymbols = () => {
    if (!editingTransition) return;
    const symbols = transitionSymbolsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    onChange({
      ...automaton,
      transitions: automaton.transitions.map((t) =>
        t.id === editingTransition.id ? { ...t, symbols: symbols.length > 0 ? symbols : ['0'] } : t
      ),
    });
    setEditingTransition(null);
  };

  const deleteTransition = (transId: string) => {
    onChange({
      ...automaton,
      transitions: automaton.transitions.filter((t) => t.id !== transId),
    });
    setSelectedTransitionId(null);
    setEditingTransition(null);
  };

  // SVG Bezier path calculator
  const renderTransition = (t: TransitionEdge) => {
    const fromNode = automaton.states.find((s) => s.id === t.from);
    const toNode = automaton.states.find((s) => s.id === t.to);
    if (!fromNode || !toNode) return null;

    const isSelected = selectedTransitionId === t.id;
    const isSelfLoop = t.from === t.to;

    // Check if there is also an opposing reverse transition (to -> from)
    const hasReverse = !isSelfLoop && automaton.transitions.some((other) => other.from === t.to && other.to === t.from);

    let pathD = '';
    let labelX = 0;
    let labelY = 0;

    const r = 26; // State radius

    if (isSelfLoop) {
      const topY = fromNode.y - r;
      pathD = `M ${fromNode.x - 12} ${topY} C ${fromNode.x - 30} ${topY - 45}, ${fromNode.x + 30} ${topY - 45}, ${fromNode.x + 12} ${topY}`;
      labelX = fromNode.x;
      labelY = topY - 48;
    } else {
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Normal perpendicular vector for curve
      const nx = -uy;
      const ny = ux;

      const curvature = hasReverse ? 32 : 12; // curve slightly to avoid overlap
      const startX = fromNode.x + ux * r;
      const startY = fromNode.y + uy * r;
      const endX = toNode.x - ux * r;
      const endY = toNode.y - uy * r;

      const midX = (startX + endX) / 2 + nx * curvature;
      const midY = (startY + endY) / 2 + ny * curvature;

      pathD = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
      labelX = midX + nx * 8;
      labelY = midY + ny * 8;
    }

    const symbolText = t.pdaOps
      ? t.pdaOps.map((op) => `${op.input}, ${op.pop} → ${op.push}`).join(' | ')
      : t.tmOps
      ? t.tmOps.map((op) => `${op.read} → ${op.write}, ${op.dir}`).join(' | ')
      : t.symbols.join(', ');

    return (
      <g
        key={t.id}
        className="cursor-pointer group"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTransitionId(t.id);
          setSelectedStateId(null);
          if (!readOnly) {
            setEditingTransition(t);
            setTransitionSymbolsInput(t.symbols.join(', '));
          }
        }}
      >
        <path
          d={pathD}
          fill="none"
          stroke={isSelected ? '#4f46e5' : '#94a3b8'}
          strokeWidth={isSelected ? '3' : '2'}
          markerEnd="url(#arrowhead)"
          className="transition-colors duration-150 group-hover:stroke-indigo-600"
        />
        {/* Invisible wider hit-area */}
        <path d={pathD} fill="none" stroke="transparent" strokeWidth="16" />

        {/* Transition label pill */}
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-Math.max(20, symbolText.length * 4.5 + 8)}
            y={-11}
            width={Math.max(40, symbolText.length * 9 + 16)}
            height={22}
            rx={6}
            className={`fill-white stroke ${
              isSelected ? 'stroke-indigo-600 shadow-sm' : 'stroke-gray-300'
            } transition-colors group-hover:stroke-indigo-500`}
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            className="fill-indigo-900 text-xs font-mono font-bold select-none pointer-events-none"
          >
            {symbolText || 'ε'}
          </text>
        </g>
      </g>
    );
  };

  const selectedState = automaton.states.find((s) => s.id === selectedStateId);

  return (
    <div className="relative w-full h-[70vh] min-h-[560px] bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col select-none shadow-sm">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 z-20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
            {automaton.type} Canvas
          </span>
          <span className="text-xs text-slate-500">
            {automaton.states.length} states, {automaton.transitions.length} transitions
          </span>
          {connectSourceId && (
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
              Click target state to connect from {getStateName(automaton, connectSourceId)}...
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {!readOnly && (
            <>
              <button
                id="btn-add-state"
                onClick={addState}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add State
              </button>
            </>
          )}

          <div className="h-4 w-px bg-gray-200 mx-1" />

                    {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-gray-100 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.05, z - 0.15))}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-gray-100 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitToScreen}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-gray-100 transition"
            title="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-gray-100 transition"
            title="Reset to 100% (no auto-fit)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden bg-slate-50/50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]"
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <defs>
            {/* Arrowhead marker definition */}
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="8"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
            </marker>
            <marker
              id="start-arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="8"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#4f46e5" />
            </marker>
          </defs>

          {/* Transitions */}
          {automaton.transitions.map(renderTransition)}

          {/* States */}
          {automaton.states.map((st) => {
            const isStart = st.id === automaton.startStateId || st.isStart;
            const isAccept = automaton.acceptStateIds.includes(st.id) || st.isAccept;
            const isSelected = selectedStateId === st.id;
            const isActive = activeStateIds.includes(st.id);
            const isConnectSource = connectSourceId === st.id;

            return (
              <g
                key={st.id}
                transform={`translate(${st.x}, ${st.y})`}
                onMouseDown={(e) => handleStateMouseDown(st, e)}
                className="cursor-pointer group"
              >
                {/* Start Arrow */}
                {isStart && (
                  <g transform="translate(-48, 0)">
                    <line
                      x1="-14"
                      y1="0"
                      x2="18"
                      y2="0"
                      stroke="#4f46e5"
                      strokeWidth="2.5"
                      markerEnd="url(#start-arrowhead)"
                    />
                    <text
                      x="-18"
                      y="4"
                      textAnchor="end"
                      className="fill-indigo-600 text-[10px] font-mono font-bold select-none"
                    >
                      START
                    </text>
                  </g>
                )}

                {/* State Glow if active */}
                {isActive && (
                  <circle
                    r="34"
                    className="fill-indigo-500/10 stroke-indigo-600 stroke-[3] animate-pulse"
                  />
                )}

                {/* State Outer Circle */}
                <circle
                  r="26"
                  className={`transition-all duration-150 ${
                    isSelected || isConnectSource
                      ? 'fill-indigo-50 stroke-indigo-600 stroke-[3] shadow-md'
                      : isActive
                      ? 'fill-indigo-100 stroke-indigo-600 stroke-[2.5]'
                      : 'fill-white stroke-slate-400 stroke-[2] group-hover:stroke-slate-600 group-hover:fill-slate-50'
                  }`}
                />

                {/* Double circle for Accept state */}
                {isAccept && (
                  <circle
                    r="21"
                    fill="none"
                    className={`stroke-[1.5] ${
                      isActive ? 'stroke-indigo-600' : isSelected ? 'stroke-indigo-600' : 'stroke-emerald-600'
                    }`}
                  />
                )}

                {/* State Label */}
                <text
                  textAnchor="middle"
                  dy="4"
                  className="fill-slate-900 font-mono font-bold text-xs select-none pointer-events-none"
                >
                  {st.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected State Context Bar (Floating Bottom-Left) */}
        {selectedState && !readOnly && (
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl p-3 shadow-lg flex items-center gap-3 z-30 animate-in fade-in">
            <div className="flex items-center gap-2 pr-2 border-r border-gray-200">
              <span className="font-mono text-sm font-bold text-indigo-600">{selectedState.name}</span>
              <span className="text-[11px] text-slate-500">
                ({selectedState.id === automaton.startStateId ? 'Start' : ''}
                {automaton.acceptStateIds.includes(selectedState.id) ? ' Accept' : ''})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setStartState(selectedState.id)}
                className={`text-xs px-2.5 py-1 rounded-md transition ${
                  selectedState.id === automaton.startStateId
                    ? 'bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
                }`}
              >
                Set as Start
              </button>

              <button
                onClick={() => toggleAcceptState(selectedState.id)}
                className={`text-xs px-2.5 py-1 rounded-md transition ${
                  automaton.acceptStateIds.includes(selectedState.id)
                    ? 'bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
                }`}
              >
                {automaton.acceptStateIds.includes(selectedState.id) ? 'Accepting ✓' : 'Make Accept'}
              </button>

              <button
                onClick={() => setConnectSourceId(selectedState.id)}
                className={`text-xs px-2.5 py-1 rounded-md transition ${
                  connectSourceId === selectedState.id
                    ? 'bg-amber-100 text-amber-800 font-semibold border border-amber-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-indigo-700 font-medium'
                }`}
              >
                + Transition
              </button>

              <button
                onClick={() => deleteState(selectedState.id)}
                className="p-1 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition ml-1"
                title="Delete state"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Transition Edit Modal / Floating Bubble */}
        {editingTransition && !readOnly && (
          <div className="absolute top-14 right-4 bg-white border border-gray-200 rounded-xl p-4 shadow-xl z-30 w-72">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-700">
                Edit Transition: {getStateName(automaton, editingTransition.from)} → {getStateName(automaton, editingTransition.to)}
              </span>
              <button
                onClick={() => deleteTransition(editingTransition.id)}
                className="text-xs text-red-500 hover:text-red-700 p-1"
                title="Delete Transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-slate-500 block">
                Symbols (comma-separated, use 'ε' for empty):
              </label>
              <input
                type="text"
                value={transitionSymbolsInput}
                onChange={(e) => setTransitionSymbolsInput(e.target.value)}
                placeholder="0, 1, ε"
                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTransitionSymbols();
                }}
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setEditingTransition(null)}
                  className="text-xs px-2.5 py-1 rounded bg-gray-100 text-slate-600 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTransitionSymbols}
                  className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
