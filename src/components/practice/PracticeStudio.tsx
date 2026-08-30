import React, { useState } from 'react';
import { PRACTICE_PROBLEMS } from '../../data/practiceProblems';
import { AutomatonDefinition, PracticeProblem } from '../../types/automata';
import { runBatchTests } from '../../utils/automataEngine';
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
  AlertCircle
} from 'lucide-react';

export const PracticeStudio: React.FC = () => {
  const [selectedProblemId, setSelectedProblemId] = useState<string>(PRACTICE_PROBLEMS[0].id);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  const selectedProblem =
    PRACTICE_PROBLEMS.find((p) => p.id === selectedProblemId) || PRACTICE_PROBLEMS[0];

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

  const handleSelectProblem = (problem: PracticeProblem) => {
    setSelectedProblemId(problem.id);
    if (problem.starterAutomaton) {
      setUserAutomaton(JSON.parse(JSON.stringify(problem.starterAutomaton)));
    }
    setTestResults([]);
    setHasRunTests(false);
    setRevealedHintIdx(-1);
    setShowSolution(false);
  };

  const handleRunAllTests = () => {
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
  };

  const filteredProblems = PRACTICE_PROBLEMS.filter((p) => {
    const matchesCat = activeCategory === 'all' || p.category === activeCategory;
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
                Solved: {solvedProblemIds.size} / {PRACTICE_PROBLEMS.length}
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
                onClick={handleRunAllTests}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
              >
                <Play className="w-4 h-4" />
                Run All Test Vectors
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedProblem.description}
            </p>
          </div>

          {/* Interactive Canvas for user automaton */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Automaton Design Canvas
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
