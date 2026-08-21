// Ported from src/Graphwar/FunctionToken.java and ValueToken.java.

export const TokenType = {
  ADD: 1,
  SUBTRACT: 2,
  MULTIPLY: 3,
  DIVIDE: 4,
  POW: 5,
  SQRT: 6,
  LOG: 7,
  ABS: 8,
  SIN: 9,
  COS: 10,
  TAN: 11,
  LN: 12,
  VARIABLE1: 13,
  VARIABLE2: 14,
  VARIABLE3: 15,
  VALUE: 16,
  LEFT_BRACKET: 17,
  RIGHT_BRACKET: 18,
};

export class FunctionToken {
  constructor(type) {
    this.type = type;
  }
}

export class ValueToken extends FunctionToken {
  constructor(value) {
    super(TokenType.VALUE);
    this.value = value;
  }
}

export class MalformedFunction extends Error {
  constructor(message) {
    super(message ?? "Malformed function");
  }
}
