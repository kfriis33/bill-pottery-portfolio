// Post-parse structural check on a function's Polish-notation token array
// (see polishNotationFunction.js), used to enforce "linear functions only"
// in teaching levels (levels.js). Mirrors PolishNotationFunction's own
// recursive-descent shape (_evaluateRec), but computes a symbolic polynomial
// degree instead of a numeric result — walking the same operator semantics
// so "degree" stays consistent with how the function actually evaluates,
// not just its surface syntax (e.g. `x - x` is still linear, `sin(5)` is
// still degree 0).

import { TokenType } from "./tokens.js";

const UNARY_MATH = {
  [TokenType.SQRT]: Math.sqrt,
  [TokenType.LOG]: Math.log10,
  [TokenType.ABS]: Math.abs,
  [TokenType.SIN]: Math.sin,
  [TokenType.COS]: Math.cos,
  [TokenType.TAN]: Math.tan,
  [TokenType.LN]: Math.log,
};

// Returns { hasVar, degree, value }. `degree` is Infinity for anything
// that isn't a polynomial in x/y/y' — a variable exponent (2^x), a
// transcendental function applied to a variable-containing operand
// (sin(x)), or dividing by a variable-containing expression (1/x).
// `value` is only meaningful when `hasVar` is false.
function degreeRec(tokens, cursor) {
  const token = tokens[cursor.i];
  cursor.i++;

  switch (token.type) {
    case TokenType.VARIABLE1:
    case TokenType.VARIABLE2:
    case TokenType.VARIABLE3:
      return { hasVar: true, degree: 1, value: NaN };

    case TokenType.VALUE:
      return { hasVar: false, degree: 0, value: token.value };

    case TokenType.ADD: {
      const a = degreeRec(tokens, cursor);
      const b = degreeRec(tokens, cursor);
      const hasVar = a.hasVar || b.hasVar;
      return { hasVar, degree: Math.max(a.degree, b.degree), value: hasVar ? NaN : a.value + b.value };
    }

    case TokenType.SUBTRACT: {
      const a = degreeRec(tokens, cursor);
      return { hasVar: a.hasVar, degree: a.degree, value: a.hasVar ? NaN : -a.value };
    }

    case TokenType.MULTIPLY: {
      const a = degreeRec(tokens, cursor);
      const b = degreeRec(tokens, cursor);
      const hasVar = a.hasVar || b.hasVar;
      return { hasVar, degree: a.degree + b.degree, value: hasVar ? NaN : a.value * b.value };
    }

    case TokenType.DIVIDE: {
      const a = degreeRec(tokens, cursor);
      const b = degreeRec(tokens, cursor);
      if (b.hasVar) return { hasVar: true, degree: Infinity, value: NaN };
      return { hasVar: a.hasVar, degree: a.degree, value: a.hasVar ? NaN : a.value / b.value };
    }

    case TokenType.POW: {
      const a = degreeRec(tokens, cursor);
      const b = degreeRec(tokens, cursor);
      if (b.hasVar) return { hasVar: true, degree: Infinity, value: NaN }; // variable exponent
      if (a.hasVar) return { hasVar: true, degree: b.value === 1 ? a.degree : Infinity, value: NaN };
      return { hasVar: false, degree: 0, value: Math.pow(a.value, b.value) };
    }

    case TokenType.SQRT:
    case TokenType.LOG:
    case TokenType.ABS:
    case TokenType.SIN:
    case TokenType.COS:
    case TokenType.TAN:
    case TokenType.LN: {
      const a = degreeRec(tokens, cursor);
      if (a.hasVar) return { hasVar: true, degree: Infinity, value: NaN };
      return { hasVar: false, degree: 0, value: UNARY_MATH[token.type](a.value) };
    }

    default:
      return { hasVar: false, degree: 0, value: 0 };
  }
}

// Highest polynomial degree of a parsed function (a PolishNotationFunction
// instance, or anything exposing the same `.tokens` array). Infinity means
// "not a polynomial at all" — always rejected by a level restricted to a
// bounded degree.
export function getFunctionDegree(polishNotationFunction) {
  return degreeRec(polishNotationFunction.tokens, { i: 0 }).degree;
}

export function isLinear(polishNotationFunction) {
  return getFunctionDegree(polishNotationFunction) <= 1;
}
