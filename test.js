/* global describe, expect, test */

const _ = require('lodash')

const { searchExact } = require('./utils')
const {
  editDistance, fuzzySearch, fuzzySearchNgrams, fuzzySearchCandidates,
  isEditDistanceNoGreaterThan, _expand
} = require('./levenshtein-search')

describe('searchExact', () => {
  const search = (needle, haystack, ...args) =>
    [...searchExact(needle, haystack, ...args)]

  test('empty needle', () => {
    expect(search('', 'TEXT')).toEqual([])
  })

  test('empty haystack', () => {
    expect(search('PATTERN', '')).toEqual([])
  })

  const testCases = {
    // name: (needle, haystack, [index, ...]),
    'identical': ['abc', 'abc', [0]],
    'substring': ['abc', '-ab-abc-ab-', [4]],
    'double first item': ['def', 'abcddefg', [4]],
    'missing second item': ['bde', 'abcdefg', []],
    'completely different': ['abc', 'def', []],
    'startswith': ['abc', 'abcd', [0]],
    'endswith': ['bcd', 'abcd', [1]],
    'multiple matches': ['abc', '-abc-abc-abc-', [1, 5, 9]]
  }

  for (const [name, data] of _.toPairs(testCases)) {
    const [needle, haystack, expected] = data

    test(`searchExact, '${name}' -> ${expected}`, () => {
      expect(search(needle, haystack)).toEqual(expected)
    })
  }

  for (const [start, expected] of [
    [1, [1, 5, 9]],
    [2, [5, 9]],
    [5, [5, 9]],
    [6, [9]]
  ]) {
    test(
      `searchExact('abc', '-abc-abc-abc-', ${start},) -> ${expected}`,
      () => {
        expect(search('abc', '-abc-abc-abc-', start)).toEqual(expected)
      }
    )
  }

  for (const [start, end, expected] of [
    [0, 3, []],
    [0, 4, [1]],
    [0, 7, [1]],
    [0, 8, [1, 5]],
    [0, 11, [1, 5]],
    [0, 12, [1, 5, 9]],
    [1, 13, [1, 5, 9]],
    [2, 13, [5, 9]],
    [5, 13, [5, 9]],
    [6, 13, [9]],
    [3, 7, []],
    [4, 10, [5]]
  ]) {
    test(
      `searchExact('abc', '-abc-abc-abc-', ${start}, ${end}) -> ${expected}`,
      () => {
        expect(search('abc', '-abc-abc-abc-', start, end)).toEqual(expected)
      }
    )
  }
})

describe('editDistance', () => {
  for (const [a, b, dist] of [
    ['', '', 0],
    ['a', '', 1],
    ['abc', 'abc', 0],
    ['abc', 'def', 3],
    ['elephant', 'relevant', 3],
    ['abc', 'aabc', 1],
    ['abc', 'abbc', 1],
    ['abc', 'abcc', 1],
    ['abc', '-abc', 1],
    ['abc', 'a-bc', 1],
    ['abc', 'ab-c', 1],
    ['abc', 'abc-', 1],
    ['aabccdeefgg', 'abcdefg', 4]
  ]) {
    test(`editDistance(${a}, ${b}) == ${dist}`, () => {
      expect(editDistance(a, b)).toBe(dist)
      expect(editDistance(b, a)).toBe(dist)
    })
  }
})

describe('fuzzySearch string', () => {
  const testedFunctions = [
    fuzzySearch, fuzzySearchNgrams, fuzzySearchCandidates
  ]

  const longstr = string => string.replace(/\s+/g, '')

  const testCases = {
    // name: (needle, haystack, [
    //   (max_l_dist, [(start, end, dist), ...]),
    // ])
    'identical sequence': ['PATTERN', 'PATTERN', [
      [0, [[0, 7, 0]]]
    ]],
    'substring': ['PATTERN', '----------PATTERN---------', [
      [0, [[10, 17, 0]]],
      [1, [[10, 17, 0]]],
      [2, [[10, 17, 0]]]
    ]],
    'double first item': ['def', 'abcddefg', [
      [1, [[4, 7, 0]]]
    ]],
    'double last item': ['def', 'abcdeffg', [
      [1, [[3, 6, 0]]]
    ]],
    'double first items': ['defgh', 'abcdedefghi', [
      [3, [[5, 10, 0]]]
    ]],
    'double last items': ['cdefgh', 'abcdefghghi', [
      [3, [[2, 8, 0]]]
    ]],
    'missing second item': ['bde', 'abcdefg', [
      [1, [[1, 5, 1]]]
    ]],
    'missing second to last item': ['bce', 'abcdefg', [
      [1, [[1, 5, 1]]],
      [2, [[1, 5, 1]]]
    ]],
    'one missing in middle': ['PATTERN', '----------PATERN---------', [
      [0, []],
      [1, [[10, 16, 1]]],
      [2, [[10, 16, 1]]]
    ]],
    'one changed in middle': ['PATTERN', '----------PAT-ERN---------', [
      [0, []],
      [1, [[10, 17, 1]]],
      [2, [[10, 17, 1]]]
    ]],
    'one extra in middle': ['PATTERN', '----------PATT-ERN---------', [
      [0, []],
      [1, [[10, 18, 1]]],
      [2, [[10, 18, 1]]]
    ]],
    'one extra repeating in middle': ['PATTERN',
      '----------PATTTERN---------',
      [
        [0, []],
        [1, [[10, 18, 1]]],
        [2, [[10, 18, 1]]]
      ]],
    'one extra repeating at end': ['PATTERN',
      '----------PATTERNN---------',
      [
        [0, [[10, 17, 0]]],
        [1, [[10, 17, 0]]],
        [2, [[10, 17, 0]]]
      ]],
    'one missing at end': ['defg', 'abcdef', [
      [1, [[3, 6, 1]]]
    ]],
    'DNA search': [
      'TGCACTGTAGGGATAACAAT',
      longstr(`
        GACTAGCACTGTAGGGATAACAATTTCACACAGGTGGACAATTACATTGAAAATCACAGATTG
        GTCACACACACATTGGACATACATAGAAACACACACACATACATTAGATACGAACATAGAAAC
        ACACATTAGACGCGTACATAGACACAAACACATTGACAGGCAGTTCAGATGATGACGCCCGAC
        TGATACTCGCGTAGTCGTGGGAGGCAAGGCACACAGGGGATAGG
      `),
      [
        [2, [[3, 24, 1]]]
      ]
    ],
    // see:
    // * BioPython archives from March 14th, 2014
    //   http://lists.open-bio.org/pipermail/biopython/2014-March/009030.html
    // * https://github.com/taleinat/fuzzysearch/issues/3
    'protein search 1': [
      'GGGTTLTTSS',
      longstr(`
        XXXXXXXXXXXXXXXXXXXGGGTTVTTSSAAAAAAAAAAAAAGGGTTLTTSSAAAAAAAAAAA
        AAAAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBGGGTTLTTSS
      `),
      [
        [0, [[42, 52, 0], [99, 109, 0]]],
        [1, [[19, 29, 1], [42, 52, 0], [99, 109, 0]]],
        [2, [[19, 29, 1], [42, 52, 0], [99, 109, 0]]]
      ]
    ],
    'protein search 2': [
      'GGGTTLTTSS',
      longstr(`
        XXXXXXXXXXXXXXXXXXXGGGTTVTTSSAAAAAAAAAAAAAGGGTTVTTSSAAAAAAAAAAA
        AAAAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBGGGTTLTTSS
      `),
      [
        [0, [[99, 109, 0]]],
        [1, [[19, 29, 1], [42, 52, 1], [99, 109, 0]]],
        [2, [[19, 29, 1], [42, 52, 1], [99, 109, 0]]]
      ]
    // ],
    // 'list of words': [
    //   'over a lazy dog'.split(' '),
    //   'the big brown fox jumped over the lazy dog'.split(' '),
    //   [
    //     [0, []],
    //     [1, [[5, 9, 1]]],
    //     [2, [[5, 9, 1]]]
    //   ]
    ]
  }

  for (const func of testedFunctions) {
    const search = (needle, haystack, maxDist) =>
      _.chain([...func(needle, haystack, maxDist)])
        .uniqWith(_.isEqual)
        .sortBy(['start', 'end', 'dist'])
        .value()

    expect(search('abc', 'abc', 0)).toEqual([{ start: 0, end: 3, dist: 0 }])
    expect(search('abc', 'a-c', 0)).toEqual([])
    expect(search('abc', 'a-c', 1)).toEqual([{ start: 0, end: 3, dist: 1 }])

    expect(search('abcdefghij', 'abcdefghij', 0))
      .toEqual([{ start: 0, end: 10, dist: 0 }])
    expect(search('abcdefghij', 'abcdefghij', 1))
      .toContainEqual({ start: 0, end: 10, dist: 0 })
    expect(search('abcdefghij', 'abcdefghi', 1))
      .toContainEqual({ start: 0, end: 9, dist: 1 })

    for (const [name, data] of _.toPairs(testCases)) {
      const [needle, haystack, maxDist2expectedMatches] = data
      for (const [maxDist, expectedMatches] of maxDist2expectedMatches) {
        const expectedMatchObjs = expectedMatches.map(
          ([start, end, dist]) => { return { start, end, dist } }
        )
        test(
          `${func.name}, '${name}', maxDist=${maxDist} -> ${expectedMatches}`,
          () => {
            expect(search(needle, haystack, maxDist)).toEqual(
              expect.arrayContaining(expectedMatchObjs)
            )
          }
        )
      }
    }
  }
})

describe('fuzzySearch array of strings', () => {
  const testedFunctions = [
    fuzzySearchCandidates
  ]
  for (const func of testedFunctions) {
    test(`${func.name}`, () => {
      const search = (needle, haystack, maxDist) =>
        _.sortedUniqBy([...func(needle, haystack, maxDist)], _.isEqual)

      expect(search(['a', 'b', 'c'], ['a', 'b', 'c'], 0))
        .toEqual([{ start: 0, end: 3, dist: 0 }])
      expect(search(['abc', 'def', 'ghi'], ['abc', 'def', 'ghi'], 0))
        .toEqual([{ start: 0, end: 3, dist: 0 }])
      expect(search(['a', 'b', 'c'], ['a', 'd', 'c'], 0))
        .toEqual([])
      expect(search(['abc', 'def', 'ghi'], ['abc', 'xyz', 'ghi'], 1))
        .toEqual([{ start: 0, end: 3, dist: 1 }])
    })
  }
})

test('isEditDistanceNoGreaterThan', () => {
  function m (str, n) {
    let result = ''
    for (;;) {
      if (n & 1) result += str
      n >>= 1
      if (n) str += str
      else break
    }
    return result
  }

  expect(isEditDistanceNoGreaterThan('a', 'a', 0)).toBe(true)
  expect(isEditDistanceNoGreaterThan('a', 'b', 0)).toBe(false)
  expect(isEditDistanceNoGreaterThan('a', 'b', 1)).toBe(true)

  expect(isEditDistanceNoGreaterThan('aaaaa', 'aaaaa', 0)).toBe(true)
  expect(isEditDistanceNoGreaterThan('aaaaa', 'baaaa', 0)).toBe(false)
  expect(isEditDistanceNoGreaterThan('aaaaa', 'aabaa', 0)).toBe(false)
  expect(isEditDistanceNoGreaterThan('aaaaa', 'aaaab', 0)).toBe(false)
  expect(isEditDistanceNoGreaterThan('aaaaa', 'aabaa', 1)).toBe(true)
  expect(isEditDistanceNoGreaterThan('aaaaa', 'aabba', 1)).toBe(false)

  const x100 = m('x', 100)
  for (const [a, b, dist] of [
    ['aaaaa', 'bbbbb', 5],
    [`${x100}yz${x100}`, m('x', 200), 2],
    [`${x100}yz${x100}`, m('x', 202), 2],
    [`${x100}yz${x100}yz${x100}`, m('x', 304), 4]
  ]) {
    if (dist > 0) {
      expect(isEditDistanceNoGreaterThan(a, b, dist - 1)).toBe(false)
    }
    expect(isEditDistanceNoGreaterThan(a, b, dist)).toBe(true)
    expect(isEditDistanceNoGreaterThan(a, b, dist + 1)).toBe(true)
  }
})

describe('_expand() unit tests', () => {
  test('both empty', () => {
    expect(_expand('', '', 0)).toEqual([0, 0])
  })

  test('empty needle', () => {
    expect(_expand('', 'haystack', 0)).toEqual([0, 0])
  })

  test('both empty', () => {
    expect(_expand('needle', '', 0)).toEqual([null, null])
  })

  test('identical', () => {
    expect(_expand('abc', 'abc', 0)).toEqual([0, 3])
    expect(_expand('abc', 'abc', 1)).toEqual([0, 3])
    expect(_expand('abc', 'abc', 2)).toEqual([0, 3])
  })

  test('first item missing', () => {
    expect(_expand('abcd', 'bcd', 0)).toEqual([null, null])
    expect(_expand('abcd', 'bcd', 1)).toEqual([1, 3])
    expect(_expand('abcd', 'bcd', 2)).toEqual([1, 3])
  })

  test('first second missing', () => {
    expect(_expand('abcd', 'acd', 0)).toEqual([null, null])
    expect(_expand('abcd', 'acd', 1)).toEqual([1, 3])
    expect(_expand('abcd', 'acd', 2)).toEqual([1, 3])
  })

  test('before last missing', () => {
    expect(_expand('abcd', 'abd', 0)).toEqual([null, null])
    expect(_expand('abcd', 'abd', 1)).toEqual([1, 3])
    expect(_expand('abcd', 'abd', 2)).toEqual([1, 3])
  })

  test('last missing', () => {
    expect(_expand('abcd', 'abc', 0)).toEqual([null, null])
    expect(_expand('abcd', 'abc', 1)).toEqual([1, 3])
    expect(_expand('abcd', 'abc', 2)).toEqual([1, 3])
  })

  test('completely different', () => {
    expect(_expand('abc', 'def', 0)).toEqual([null, null])
    expect(_expand('abc', 'def', 1)).toEqual([null, null])
    expect(_expand('abc', 'def', 2)).toEqual([null, null])
    expect(_expand('abc', 'def', 3)).toEqual([3, 3])
  })

  test('startswith', () => {
    expect(_expand('abc', 'abcd', 0)).toEqual([0, 3])
    expect(_expand('abc', 'abcd', 1)).toEqual([0, 3])
    expect(_expand('abc', 'abcd', 2)).toEqual([0, 3])
  })

  test('missing at start, middle, and end', () => {
    expect(_expand('abcd', '-ab-cd-', 0)).toEqual([null, null])
    expect(_expand('abcd', '-ab-cd-', 1)).toEqual([null, null])
    expect(_expand('abcd', '-ab-cd-', 2)).toEqual([2, 6])
    expect(_expand('abcd', '-ab-cd-', 3)).toEqual([2, 6])
  })

  test('long needle', () => {
    expect(_expand('abcdefghijklmnop', 'abcdefg-hijk-mnopqrst', 0))
      .toEqual([null, null])
    expect(_expand('abcdefghijklmnop', 'abcdefg-hijk-mnopqrst', 1))
      .toEqual([null, null])
    expect(_expand('abcdefghijklmnop', 'abcdefg-hijk-mnopqrst', 2))
      .toEqual([2, 17])
    expect(_expand('abcdefghijklmnop', 'abcdefg-hijk-mnopqrst', 3))
      .toEqual([2, 17])
  })
})
