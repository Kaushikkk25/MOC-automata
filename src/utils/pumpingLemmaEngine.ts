import { PumpingLemmaLanguage } from '../types/automata';

function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

export const PUMPING_LEMMA_LANGUAGES: PumpingLemmaLanguage[] = [
  // 1. a^n b^n
  {
    id: 'an_bn',
    name: 'Equal As and Bs: L = { aⁿ bⁿ | n ≥ 0 }',
    type: 'regular',
    formulaLatex: 'L = \\{ a^n b^n \\mid n \\ge 0 \\}',
    description: 'The standard introductory non-regular language. Finite automata cannot remember arbitrary count n without unbounded states.',
    alphabet: ['a', 'b'],
    adversaryPStrategy: (p: number) => ({ minP: 1, recommendedP: 3 }),
    sampleStrings: (p: number) => [
      {
        label: `a^${p} b^${p}`,
        value: `${'a'.repeat(p)}${'b'.repeat(p)}`,
        isOptimal: true,
        hint: `Selecting w = a^p b^p forces the substring y to consist entirely of 'a's since |xy| ≤ p.`,
      },
      {
        label: `a^${p+2} b^${p+2}`,
        value: `${'a'.repeat(p+2)}${'b'.repeat(p+2)}`,
        isOptimal: true,
        hint: `Any n ≥ p works effectively.`,
      },
      {
        label: `a^${Math.max(1, p-1)} b^${Math.max(1, p-1)}`,
        value: `${'a'.repeat(Math.max(1, p-1))}${'b'.repeat(Math.max(1, p-1))}`,
        isOptimal: false,
        hint: `Length is less than p, which violates the requirement |w| ≥ p.`,
      },
    ],
    validSplits: (w: string, p: number) => {
      // Possible splits where |xy| <= p and |y| >= 1
      const splits = [];
      const prefix = w.slice(0, p);
      for (let xLen = 0; xLen < p; xLen++) {
        for (let yLen = 1; xLen + yLen <= p; yLen++) {
          const x = prefix.slice(0, xLen);
          const y = prefix.slice(xLen, xLen + yLen);
          const z = w.slice(xLen + yLen);
          splits.push({ x, y, z });
        }
      }
      return splits.slice(0, 6);
    },
    testPump: (split, i) => {
      const pumped = `${split.x}${split.y.repeat(i)}${split.z}`;
      // Check if pumped is in a^n b^n
      const match = pumped.match(/^(a*)(b*)$/);
      let inLanguage = false;
      let reason = '';

      if (!match) {
        reason = `String '${pumped}' contains interleaving 'a' and 'b' characters out of order.`;
      } else {
        const numA = match[1].length;
        const numB = match[2].length;
        if (numA === numB) {
          inLanguage = true;
          reason = `String '${pumped}' has equal numbers of 'a's (${numA}) and 'b's (${numB}), so it remains in L. Try a different i!`;
        } else {
          reason = `Contradiction: String has ${numA} 'a's and ${numB} 'b's (${numA} ≠ ${numB}), which violates L = {aⁿ bⁿ}.`;
        }
      }

      return { pumpedString: pumped, inLanguage, reason };
    },
    formalProof: {
      theorem: 'L = \\{ a^n b^n \\mid n \\ge 0 \\} \\text{ is not regular.}',
      choiceOfW: 'Assume L is regular. Let p be the pumping length. Choose w = a^p b^p \\in L, with |w| = 2p \\ge p.',
      adversarySplits: 'By the Pumping Lemma, w = xyz with |xy| \\le p and |y| \\ge 1. Since |xy| \\le p, y consists entirely of \'a\'s (y = a^k, where k \\ge 1).',
      contradictionCase: 'Consider pumping with i = 0 (or i = 2). Then xy^0 z = a^{p-k} b^p. Since k \\ge 1, the number of \'a\'s is p - k < p, while the number of \'b\'s is p. Thus, xy^0 z \\notin L.',
      conclusion: 'This contradicts the Pumping Lemma. Therefore, L is not regular.',
    },
  },

  // 2. Palindromes w w^R
  {
    id: 'palindromes',
    name: 'Palindromes: L = { w wᴿ | w ∈ {0,1}* }',
    type: 'regular',
    formulaLatex: 'L = \\{ w w^R \\mid w \\in \\{0,1\\}^* \\}',
    description: 'Even-length binary palindromes. Requires infinite memory to compare the middle mirrored halves.',
    alphabet: ['0', '1'],
    adversaryPStrategy: (p: number) => ({ minP: 1, recommendedP: 3 }),
    sampleStrings: (p: number) => [
      {
        label: `0^${p} 1 1 0^${p}`,
        value: `${'0'.repeat(p)}11${'0'.repeat(p)}`,
        isOptimal: true,
        hint: `Choosing 0^p 1 1 0^p traps y entirely inside the first block of '0's.`,
      },
      {
        label: `(01)^${p} (10)^${p}`,
        value: `${'01'.repeat(p)}${'10'.repeat(p)}`,
        isOptimal: false,
        hint: `More complex than needed; simpler blocks of 0s isolate y easily.`,
      },
    ],
    validSplits: (w: string, p: number) => {
      const splits = [];
      const prefix = w.slice(0, p);
      for (let xLen = 0; xLen < p; xLen++) {
        for (let yLen = 1; xLen + yLen <= p; yLen++) {
          const x = prefix.slice(0, xLen);
          const y = prefix.slice(xLen, xLen + yLen);
          const z = w.slice(xLen + yLen);
          splits.push({ x, y, z });
        }
      }
      return splits.slice(0, 6);
    },
    testPump: (split, i) => {
      const pumped = `${split.x}${split.y.repeat(i)}${split.z}`;
      const isEven = pumped.length % 2 === 0;
      let inLanguage = false;
      let reason = '';

      if (!isEven) {
        reason = `String length is ${pumped.length} (odd), so it cannot be of form w wᴿ.`;
      } else {
        const half = pumped.length / 2;
        const left = pumped.slice(0, half);
        const rightReversed = pumped.slice(half).split('').reverse().join('');
        if (left === rightReversed) {
          inLanguage = true;
          reason = `String '${pumped}' is a valid palindrome of form w wᴿ.`;
        } else {
          reason = `Contradiction: Left half '${left}' does not mirror right half reversed '${rightReversed}'.`;
        }
      }
      return { pumpedString: pumped, inLanguage, reason };
    },
    formalProof: {
      theorem: 'L = \\{ w w^R \\mid w \\in \\{0,1\\}^* \\} \\text{ is not regular.}',
      choiceOfW: 'Assume L is regular. Let p be the pumping length. Choose w = 0^p 1 1 0^p \\in L.',
      adversarySplits: 'Since |xy| \\le p, the substring y must consist entirely of 0s from the initial block, i.e., y = 0^k with k \\ge 1.',
      contradictionCase: 'Pump with i = 2: w\' = x y^2 z = 0^{p+k} 1 1 0^p. For w\' to be in L, the leading 0s must equal trailing 0s, but p + k \\ne p since k \\ge 1.',
      conclusion: 'Thus w\' \\notin L, contradicting the Pumping Lemma. Therefore, L is not regular.',
    },
  },

  // 3. Squares: 0^(n^2)
  {
    id: 'squares',
    name: 'Square Lengths: L = { 0ⁿ² | n ≥ 0 }',
    type: 'regular',
    formulaLatex: 'L = \\{ 0^{n^2} \\mid n \\ge 0 \\}',
    description: 'Unary strings whose lengths are perfect squares (0, 1, 4, 9, 16, 25...). Gaps between consecutive squares grow without bound.',
    alphabet: ['0'],
    adversaryPStrategy: (p: number) => ({ minP: 1, recommendedP: 3 }),
    sampleStrings: (p: number) => [
      {
        label: `0^(${p}²) = 0^${p * p}`,
        value: '0'.repeat(p * p),
        isOptimal: true,
        hint: `w = 0^(p^2) ensures |w| = p^2 ≥ p. Pumping will land strictly between p^2 and (p+1)^2.`,
      },
    ],
    validSplits: (w: string, p: number) => {
      const splits = [];
      for (let yLen = 1; yLen <= p; yLen++) {
        splits.push({
          x: '',
          y: '0'.repeat(yLen),
          z: '0'.repeat(w.length - yLen),
        });
      }
      return splits;
    },
    testPump: (split, i) => {
      const pumped = `${split.x}${split.y.repeat(i)}${split.z}`;
      const len = pumped.length;
      const sqrt = Math.sqrt(len);
      const isPerfectSquare = Number.isInteger(sqrt);
      let reason = '';

      if (isPerfectSquare) {
        reason = `Length ${len} is ${sqrt}², which is a perfect square.`;
      } else {
        const lower = Math.floor(sqrt);
        const upper = Math.ceil(sqrt);
        reason = `Contradiction: Length ${len} is not a square! It falls strictly between ${lower}² (${lower * lower}) and ${upper}² (${upper * upper}).`;
      }
      return { pumpedString: pumped, inLanguage: isPerfectSquare, reason };
    },
    formalProof: {
      theorem: 'L = \\{ 0^{n^2} \\mid n \\ge 0 \\} \\text{ is not regular.}',
      choiceOfW: 'Assume L is regular. Let p be the pumping length. Choose w = 0^{p^2} \\in L.',
      adversarySplits: 'By the lemma, w = xyz with |xy| \\le p and |y| = k \\ge 1. Since |xy| \\le p, 1 \\le k \\le p.',
      contradictionCase: 'Pump with i = 2: |x y^2 z| = p^2 + k. Since 1 \\le k \\le p, we have p^2 < p^2 + k \\le p^2 + p < (p+1)^2 = p^2 + 2p + 1. The length is strictly between two consecutive squares, so x y^2 z \\notin L.',
      conclusion: 'Therefore, L is not regular.',
    },
  },

  // 4. Primes: a^p
  {
    id: 'primes',
    name: 'Prime Lengths: L = { aᵖ | p is prime }',
    type: 'regular',
    formulaLatex: 'L = \\{ a^p \\mid p \\text{ is prime} \\}',
    description: 'Unary strings whose lengths are prime numbers (2, 3, 5, 7, 11, 13...).',
    alphabet: ['a'],
    adversaryPStrategy: (p: number) => ({ minP: 2, recommendedP: 3 }),
    sampleStrings: (p: number) => {
      // Find prime >= p
      let pr = Math.max(2, p);
      while (!isPrime(pr)) pr++;
      return [
        {
          label: `a^${pr} (prime length ≥ ${p})`,
          value: 'a'.repeat(pr),
          isOptimal: true,
          hint: `Picking a prime length q ≥ p allows pumping with i = q + 1 to factorize the length.`,
        },
      ];
    },
    validSplits: (w: string, p: number) => {
      const splits = [];
      for (let yLen = 1; yLen <= Math.min(p, w.length); yLen++) {
        splits.push({
          x: '',
          y: 'a'.repeat(yLen),
          z: 'a'.repeat(w.length - yLen),
        });
      }
      return splits;
    },
    testPump: (split, i) => {
      const pumped = `${split.x}${split.y.repeat(i)}${split.z}`;
      const len = pumped.length;
      const prime = isPrime(len);
      let reason = '';

      if (prime) {
        reason = `Length ${len} is prime.`;
      } else {
        reason = `Contradiction: Length ${len} is composite (not prime)! Specifically, ${len} = ${split.x.length + split.z.length} + ${i} × ${split.y.length}.`;
      }
      return { pumpedString: pumped, inLanguage: prime, reason };
    },
    formalProof: {
      theorem: 'L = \\{ a^p \\mid p \\text{ is prime} \\} \\text{ is not regular.}',
      choiceOfW: 'Assume L is regular with pumping length p. Choose prime q \\ge p + 2, and let w = a^q \\in L.',
      adversarySplits: 'w = xyz with |xy| \\le p and |y| = k \\ge 1. Then |xz| = q - k.',
      contradictionCase: 'Pump with i = q - k + 1: |x y^{q-k+1} z| = |xz| + (q-k+1)|y| = (q-k) + (q-k+1)k = (q-k)(1 + k) + k... specifically, |x y^{q+1} z| = q + q \\cdot k = q(1+k), which is a composite number since q \\ge 2 and k+1 \\ge 2.',
      conclusion: 'Thus x y^{q+1} z \\notin L, proving L is not regular.',
    },
  },

  // 5. Non-CFL: a^n b^n c^n
  {
    id: 'an_bn_cn',
    name: 'Three Counts (Non-CFL): L = { aⁿ bⁿ cⁿ | n ≥ 0 }',
    type: 'context-free',
    formulaLatex: 'L = \\{ a^n b^n c^n \\mid n \\ge 0 \\}',
    description: 'Classic non-context-free language. A pushdown stack can match two symbols (e.g. aⁿ bⁿ), but cannot verify a third symbol count.',
    alphabet: ['a', 'b', 'c'],
    adversaryPStrategy: (p: number) => ({ minP: 1, recommendedP: 3 }),
    sampleStrings: (p: number) => [
      {
        label: `a^${p} b^${p} c^${p}`,
        value: `${'a'.repeat(p)}${'b'.repeat(p)}${'c'.repeat(p)}`,
        isOptimal: true,
        hint: `Choosing w = a^p b^p c^p ensures vxy cannot contain all three symbols since |vxy| ≤ p.`,
      },
    ],
    validSplits: (w: string, p: number) => {
      // Split into u v x y z with |vxy| <= p and |vy| >= 1
      return [
        {
          u: 'a'.repeat(Math.max(0, p - 2)),
          v: 'a',
          w_mid: 'a',
          y: 'b',
          x: 'b'.repeat(Math.max(0, p - 1)) + 'c'.repeat(p),
          z: '',
        },
        {
          u: 'a'.repeat(p),
          v: 'b',
          w_mid: 'b'.repeat(Math.max(0, p - 2)),
          y: 'c',
          x: 'c'.repeat(Math.max(0, p - 1)),
          z: '',
        },
      ];
    },
    testPump: (split, i) => {
      // For CFL: u v^i w_mid y^i x
      const u = split.u || '';
      const v = split.v || '';
      const mid = split.w_mid || '';
      const y = split.y || '';
      const tail = split.x || split.z || '';

      const pumped = `${u}${v.repeat(i)}${mid}${y.repeat(i)}${tail}`;
      const match = pumped.match(/^(a*)(b*)(c*)$/);
      let inLanguage = false;
      let reason = '';

      if (!match) {
        reason = `Symbols are out of order in '${pumped}'.`;
      } else {
        const aCount = match[1].length;
        const bCount = match[2].length;
        const cCount = match[3].length;
        if (aCount === bCount && bCount === cCount) {
          inLanguage = true;
          reason = `Equal counts of a, b, c (${aCount}).`;
        } else {
          reason = `Contradiction: Counts differ! #a = ${aCount}, #b = ${bCount}, #c = ${cCount}. Violates L = { aⁿ bⁿ cⁿ }.`;
        }
      }
      return { pumpedString: pumped, inLanguage, reason };
    },
    formalProof: {
      theorem: 'L = \\{ a^n b^n c^n \\mid n \\ge 0 \\} \\text{ is not context-free.}',
      choiceOfW: 'Assume L is CFL. Let p be the CFL pumping length. Choose w = a^p b^p c^p \\in L with |w| = 3p \\ge p.',
      adversarySplits: 'By the CFL Pumping Lemma, w = uvxyz with |vxy| \\le p and |vy| \\ge 1. Since |vxy| \\le p, the substring vy can contain at most two distinct types of symbols (either a\'s and b\'s, or b\'s and c\'s, but NEVER all three).',
      contradictionCase: 'Pump with i = 0 (or i = 2): In u v^0 x y^0 z, the symbols contained in vy decrease, while the symbol not in vy remains at count p. Hence the counts are no longer equal.',
      conclusion: 'Therefore, L is not context-free.',
    },
  },

  // 6. Copy Language w w (Non-CFL)
  {
    id: 'copy_language',
    name: 'Copy Language (Non-CFL): L = { w w | w ∈ {0,1}* }',
    type: 'context-free',
    formulaLatex: 'L = \\{ w w \\mid w \\in \\{0,1\\}^* \\}',
    description: 'Direct repetition of arbitrary binary strings. Requires a queue or 2-way access, not achievable with a single LIFO stack.',
    alphabet: ['0', '1'],
    adversaryPStrategy: (p: number) => ({ minP: 1, recommendedP: 3 }),
    sampleStrings: (p: number) => [
      {
        label: `0^${p} 1^${p} 0^${p} 1^${p}`,
        value: `${'0'.repeat(p)}${'1'.repeat(p)}${'0'.repeat(p)}${'1'.repeat(p)}`,
        isOptimal: true,
        hint: `w = 0^p 1^p 0^p 1^p prevents vy from modifying both copies symmetrically.`,
      },
    ],
    validSplits: (w: string, p: number) => [
      {
        u: '0'.repeat(Math.max(0, p - 1)),
        v: '0',
        w_mid: '1'.repeat(p),
        y: '0',
        x: '0'.repeat(Math.max(0, p - 1)) + '1'.repeat(p),
        z: '',
      },
    ],
    testPump: (split, i) => {
      const u = split.u || '';
      const v = split.v || '';
      const mid = split.w_mid || '';
      const y = split.y || '';
      const tail = split.x || split.z || '';

      const pumped = `${u}${v.repeat(i)}${mid}${y.repeat(i)}${tail}`;
      const half = pumped.length / 2;
      const left = pumped.slice(0, half);
      const right = pumped.slice(half);
      const isCopy = left === right && pumped.length % 2 === 0;

      return {
        pumpedString: pumped,
        inLanguage: isCopy,
        reason: isCopy
          ? `String '${pumped}' satisfies w w (both halves are '${left}').`
          : `Contradiction: Left half '${left}' ≠ Right half '${right}'. String is not in L.`,
      };
    },
    formalProof: {
      theorem: 'L = \\{ w w \\mid w \\in \\{0,1\\}^* \\} \\text{ is not context-free.}',
      choiceOfW: 'Assume L is CFL. Let p be pumping length. Choose s = 0^p 1^p 0^p 1^p \\in L.',
      adversarySplits: 'Since |vxy| \\le p, vy cannot span across both copies of 0^p 1^p symmetrically.',
      contradictionCase: 'Pumping s\' = u v^2 x y^2 z disturbs either the first copy or the second copy, but not both equally. Thus the two halves cannot match.',
      conclusion: 'Therefore, the copy language is not context-free.',
    },
  },
];
