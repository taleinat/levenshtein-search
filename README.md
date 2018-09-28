# levenshtein-search

A Javascript library for fuzzy substring search.

## Features

* Optimized for many use cases, including:
    * Long sub-strings with *small* max. distance
    * Long sub-strings with *large* max. distance
* Non-trivial, rarely implemented algorithms
* Simple interface, automatically uses the most appropriate algorithm.
* Extensive test suite
* No dependencies

## Examples

#### `fuzzySearch()`

A generator function which yields all fuzzy matches of 'needle' in
'haystack', matching to within the given maximum Levenshtein distance.

```js
> [...fuzzySearch('PATTERN', '---PATERN---', 1)]
[ { start: 3, end: 9, dist: 1 } ]
> [...fuzzySearch('elephant', 'There is nothing relevant here', 1)]
[]
> [...fuzzySearch('elephant', 'There is nothing relevant here', 2)]
[ { start: 18, end: 25, dist: 2 } ]
> [...fuzzySearch('erors', 'Some text with errors in it', 1)]
[ { start: 17, end: 21, dist: 1 },
  { start: 15, end: 21, dist: 1 } ]
> var text = 'There are many strange words in this world, not all worth mentioning.'
> [...fuzzySearch('word', text, 0)]
[ { start: 23, end: 27, dist: 0 } ]
> [...fuzzySearch('word', text, 1)]
[ { start: 24, end: 27, dist: 1 },
  { start: 23, end: 27, dist: 0 },
  { start: 37, end: 41, dist: 1 },
  { start: 37, end: 42, dist: 1 },
  { start: 52, end: 56, dist: 1 } ]
> [...fuzzySearch('warts', text, 1)]
[]
> [...fuzzySearch('warts', text, 2)]
[ { start: 23, end: 28, dist: 2 },
  { start: 52, end: 57, dist: 2 } ]
```

#### `editDistance()`

Computes the edit distance, a.k.a. the Levenshtein distance, between
two strings.

```js
> editDistance('elephant', 'relevant')
3
> editDistance('same', 'same')
0
> editDistance('error', 'erorr')
2
```

#### `isEditDistanceNoGreaterThan()`

This is optimized to do less computation than `editDistance()`,
*much* less when the given maximum distance is small compared to the
lengths of the inputs.

```js
> isEditDistanceNoGreaterThan('elephant', 'relevant', 3)
true
> isEditDistanceNoGreaterThan('elephant', 'relevant', 2)
false
```

## Notes

1. This is a partial Javascript port of the
   [Python 'fuzzysearch' library](https://github.com/taleinat/fuzzysearch),
   which is written by the same author and licensed under similar terms.
2. Filtering of redundant results is currently not implemented.

## Licensing

© 2018 Tal Einat.

Licensed under the terms of
[the MIT license](https://opensource.org/licenses/MIT).
See LICENSE for details.
