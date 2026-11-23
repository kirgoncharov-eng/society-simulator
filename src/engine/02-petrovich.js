/*
 * First-name rules and matching adapted from petrovich-js 0.2.1.
 * Source: https://github.com/petrovich/petrovich-js/tree/41858f9e3073aa593856968d90061d0771f57743
 * Upstream files: petrovich.js, rules.json (firstname).
 * SPDX-License-Identifier: MIT
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013 Petrovich
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const PETROVICH_FIRST_NAME = {
  exceptions: [
    { gender: 'male', test: ["лев"], mods: ["--ьва","--ьву","--ьва","--ьвом","--ьве"] },
    { gender: 'male', test: ["пётр"], mods: ["---етра","---етру","---етра","---етром","---етре"] },
    { gender: 'male', test: ["павел"], mods: ["--ла","--лу","--ла","--лом","--ле"] },
    { gender: 'male', test: ["яша"], mods: ["-и","-е","-у","-ей","-е"] },
    { gender: 'male', test: ["шота"], mods: [".",".",".",".","."] },
    { gender: 'female', test: ["рашель","нинель","николь","габриэль","даниэль"], mods: [".",".",".",".","."] },
  ],
  suffixes: [
    { gender: 'androgynous', test: ["е","ё","и","о","у","ы","э","ю"], mods: [".",".",".",".","."] },
    { gender: 'female', test: ["б","в","г","д","ж","з","й","к","л","м","н","п","р","с","т","ф","х","ц","ч","ш","щ","ъ"], mods: [".",".",".",".","."] },
    { gender: 'female', test: ["ь"], mods: ["-и","-и",".","ю","-и"] },
    { gender: 'male', test: ["ь"], mods: ["-я","-ю","-я","-ем","-е"] },
    { gender: 'androgynous', test: ["га","ка","ха","ча","ща","жа"], mods: ["-и","-е","-у","-ой","-е"] },
    { gender: 'female', test: ["ша"], mods: ["-и","-е","-у","-ей","-е"] },
    { gender: 'androgynous', test: ["а"], mods: ["-ы","-е","-у","-ой","-е"] },
    { gender: 'female', test: ["ия"], mods: ["-и","-и","-ю","-ей","-и"] },
    { gender: 'female', test: ["а"], mods: ["-ы","-е","-у","-ой","-е"] },
    { gender: 'female', test: ["я"], mods: ["-и","-е","-ю","-ей","-е"] },
    { gender: 'male', test: ["ия"], mods: ["-и","-и","-ю","-ей","-и"] },
    { gender: 'male', test: ["я"], mods: ["-и","-е","-ю","-ей","-е"] },
    { gender: 'male', test: ["ей"], mods: ["-я","-ю","-я","-ем","-е"] },
    { gender: 'male', test: ["ий"], mods: ["-я","-ю","-я","-ем","-и"] },
    { gender: 'male', test: ["й"], mods: ["-я","-ю","-я","-ем","-е"] },
    { gender: 'male', test: ["б","в","г","д","ж","з","к","л","м","н","п","р","с","т","ф","х","ц","ч"], mods: ["а","у","а","ом","е"] },
    { gender: 'androgynous', test: ["ния","рия","вия"], mods: ["-и","-и","-ю","-ем","-ем"] },
  ],
};
const NAME_CASES = ['genitive', 'dative', 'accusative', 'instrumental', 'prepositional'];
const nameForms = new Map();

function petrovichFirstRule(gender, lowerName, rules, wholeWord) {
  return rules.find(rule => (rule.gender === 'androgynous' || rule.gender === gender)
    && rule.test.some(sample => wholeWord ? lowerName === sample : lowerName.endsWith(sample)));
}

function petrovichApplyMod(name, mod) {
  for (const char of mod) {
    if (char === '-') name = name.slice(0, -1);
    else if (char !== '.') name += char;
  }
  return name;
}

function nameCase(a, padezh) {
  const name = a.name;
  const index = NAME_CASES.indexOf(padezh);
  if (!name || index < 0 || (a.sex !== 'm' && a.sex !== 'f')) return name;

  const cacheKey = a.sex + ':' + padezh + ':' + name;
  const cached = nameForms.get(cacheKey);
  if (cached !== undefined) return cached;

  const gender = a.sex === 'm' ? 'male' : 'female';
  const { exceptions, suffixes } = PETROVICH_FIRST_NAME;
  const form = name.split('-').map(part => {
    const lower = part.toLowerCase();
    const exception = petrovichFirstRule(gender, lower, exceptions, true);
    if (exception) return petrovichApplyMod(part, exception.mods[index]);
    // Upstream's generic masculine -а rule gives «Сашы» for an unmatched -ша name.
    if (a.sex === 'm' && lower.endsWith('ша')) {
      return petrovichApplyMod(part, ['-и', '-е', '-у', '-ей', '-е'][index]);
    }
    const suffix = petrovichFirstRule(gender, lower, suffixes, false);
    if (suffix) return petrovichApplyMod(part, suffix.mods[index]);
    // The upstream table has no generic masculine rule for these consonants.
    if (a.sex === 'm' && /[шщ]$/.test(lower)) return part + ['а', 'у', 'а', 'ем', 'е'][index];
    return part;
  }).join('-');
  nameForms.set(cacheKey, form);
  return form;
}
