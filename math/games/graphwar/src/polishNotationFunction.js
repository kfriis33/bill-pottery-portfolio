// Ported from src/Graphwar/PolishNotationFunction.java. Only parsing and
// evaluation are ported — the genetic-algorithm helpers (mutate/crossover/
// makeRandomFunction) exist in the Java version to drive the AI opponent and
// aren't needed for the GraphPlane prototype, so they're intentionally left out.

import { FunctionToken, ValueToken, TokenType, MalformedFunction } from "./tokens.js";

const NUMBER_PATTERN = /[0-9]*\.?[0-9]+|\(|\)|x|y'|y|\+|\*|\/|\^|sqrt|log|abs|sin|sen|cos|tan|tg|-|ln|e|pi/g;
const PURE_NUMBER = /^[0-9]*\.?[0-9]+$/;

function isOperation(type) {
  return type >= 1 && type <= 12;
}

function getNumParam(type) {
  if (type === TokenType.SUBTRACT) return 1;
  if (type >= TokenType.ADD && type <= TokenType.POW) return 2;
  if (type >= TokenType.SQRT && type <= TokenType.LN) return 1;
  return 0;
}

function precedes(t0, t1) {
  return t0 < t1;
}

function isImplicit(type1, type2) {
  const valueLike1 =
    type1 === TokenType.VALUE ||
    type1 === TokenType.VARIABLE1 ||
    type1 === TokenType.VARIABLE2 ||
    type1 === TokenType.VARIABLE3 ||
    type1 === TokenType.RIGHT_BRACKET;

  if (!valueLike1) return false;

  return (
    type2 === TokenType.VALUE ||
    type2 === TokenType.VARIABLE1 ||
    type2 === TokenType.VARIABLE2 ||
    type2 === TokenType.VARIABLE3 ||
    type2 === TokenType.LEFT_BRACKET ||
    getNumParam(type2) === 1
  );
}

function adjustImplicitMultiplications(tokens) {
  if (tokens.length === 0) return tokens;

  const result = [tokens[0]];

  for (let i = 1; i < tokens.length; i++) {
    const last = tokens[i - 1];
    const next = tokens[i];

    if (isImplicit(last.type, next.type)) {
      result.push(new FunctionToken(TokenType.MULTIPLY));
    }

    result.push(next);
  }

  return result;
}

function createRegularNotationTokens(argStr) {
  let funcStr = argStr.toLowerCase();
  funcStr = funcStr.replaceAll("-", "+-");
  funcStr = funcStr.replaceAll("exp", "e^");
  funcStr = funcStr.replaceAll(",", ".");

  const tokens = [];
  let match;

  NUMBER_PATTERN.lastIndex = 0;
  while ((match = NUMBER_PATTERN.exec(funcStr)) !== null) {
    const token = match[0];

    if (PURE_NUMBER.test(token)) {
      tokens.push(new ValueToken(Number.parseFloat(token)));
      continue;
    }

    switch (token) {
      case "x":
        tokens.push(new FunctionToken(TokenType.VARIABLE1));
        break;
      case "y":
        tokens.push(new FunctionToken(TokenType.VARIABLE2));
        break;
      case "y'":
        tokens.push(new FunctionToken(TokenType.VARIABLE3));
        break;
      case "+":
        tokens.push(new FunctionToken(TokenType.ADD));
        break;
      case "-":
        tokens.push(new FunctionToken(TokenType.SUBTRACT));
        break;
      case "*":
        tokens.push(new FunctionToken(TokenType.MULTIPLY));
        break;
      case "/":
        tokens.push(new FunctionToken(TokenType.DIVIDE));
        break;
      case "sqrt":
        tokens.push(new FunctionToken(TokenType.SQRT));
        break;
      case "log":
        tokens.push(new FunctionToken(TokenType.LOG));
        break;
      case "abs":
        tokens.push(new FunctionToken(TokenType.ABS));
        break;
      case "sin":
      case "sen":
        tokens.push(new FunctionToken(TokenType.SIN));
        break;
      case "cos":
        tokens.push(new FunctionToken(TokenType.COS));
        break;
      case "tan":
      case "tg":
        tokens.push(new FunctionToken(TokenType.TAN));
        break;
      case "^":
        tokens.push(new FunctionToken(TokenType.POW));
        break;
      case "ln":
        tokens.push(new FunctionToken(TokenType.LN));
        break;
      case "e":
        tokens.push(new ValueToken(Math.E));
        break;
      case "pi":
        tokens.push(new ValueToken(Math.PI));
        break;
      case "(":
        tokens.push(new FunctionToken(TokenType.LEFT_BRACKET));
        break;
      case ")":
        tokens.push(new FunctionToken(TokenType.RIGHT_BRACKET));
        break;
      default:
        break;
    }
  }

  return adjustImplicitMultiplications(tokens);
}

function reorderRec(polishTokens, funcTokens, start, end) {
  if (start > end || start >= funcTokens.length) return false;

  let next = -1;
  let nextNest = Number.POSITIVE_INFINITY;
  let nest = 0;

  for (let i = start; i <= end; i++) {
    const type = funcTokens[i].type;

    if (type === TokenType.LEFT_BRACKET) {
      nest++;
    } else if (type === TokenType.RIGHT_BRACKET) {
      nest--;
    } else if (nest < nextNest || (nest === nextNest && (next === -1 || precedes(type, funcTokens[next].type)))) {
      next = i;
      nextNest = nest;
    }
  }

  if (next === -1) return false;

  switch (getNumParam(funcTokens[next].type)) {
    case 0:
      polishTokens.push(funcTokens[next]);
      break;

    case 1:
      polishTokens.push(funcTokens[next]);
      reorderRec(polishTokens, funcTokens, next + 1, end);
      break;

    case 2: {
      polishTokens.push(funcTokens[next]);
      const leftExists = reorderRec(polishTokens, funcTokens, start, next - 1);

      if (funcTokens[next].type === TokenType.ADD && !leftExists) {
        polishTokens.push(new ValueToken(0));
      }

      reorderRec(polishTokens, funcTokens, next + 1, end);
      break;
    }

    default:
      break;
  }

  return true;
}

function reorderTokensToPolishNotation(funcTokens) {
  const polishTokens = [];
  reorderRec(polishTokens, funcTokens, 0, funcTokens.length - 1);
  return polishTokens;
}

function getValuesNeeded(tokens) {
  let valuesNeeded = 1;

  for (let i = 0; i < tokens.length; i++) {
    if (isOperation(tokens[i].type)) {
      valuesNeeded += getNumParam(tokens[i].type) - 1;
    } else {
      valuesNeeded--;
    }

    if (valuesNeeded === 0 && i + 1 < tokens.length) {
      return -1;
    }
  }

  return valuesNeeded;
}

function printToken(token) {
  switch (token.type) {
    case TokenType.VARIABLE1:
      return "x";
    case TokenType.VARIABLE2:
      return "y";
    case TokenType.VARIABLE3:
      return "y'";
    case TokenType.VALUE: {
      const rounded = Math.round(token.value * 100) / 100;
      return String(rounded);
    }
    case TokenType.ADD:
      return "+";
    case TokenType.SUBTRACT:
      return "-";
    case TokenType.MULTIPLY:
      return "*";
    case TokenType.DIVIDE:
      return "/";
    case TokenType.SQRT:
      return "sqrt";
    case TokenType.LOG:
      return "log";
    case TokenType.ABS:
      return "abs";
    case TokenType.SIN:
      return "sin";
    case TokenType.COS:
      return "cos";
    case TokenType.TAN:
      return "tan";
    case TokenType.POW:
      return "^";
    case TokenType.LN:
      return "ln";
    default:
      return "";
  }
}

export class PolishNotationFunction {
  constructor(funcStr) {
    const normalNotation = createRegularNotationTokens(funcStr);
    this.tokens = reorderTokensToPolishNotation(normalNotation);
    this.readLocation = 0;

    if (getValuesNeeded(this.tokens) !== 0) {
      throw new MalformedFunction(`Could not parse function: ${funcStr}`);
    }
  }

  getStringFunction() {
    this.readLocation = 0;
    return this._makeString();
  }

  _makeString() {
    const currentToken = this.tokens[this.readLocation];
    this.readLocation++;

    const type = currentToken.type;
    let str = "";

    if (isOperation(type)) {
      if (getNumParam(type) === 2) {
        str += `(${this._makeString()}`;
        str += printToken(currentToken);
        str += `${this._makeString()})`;
      } else if (type === TokenType.SUBTRACT) {
        str += `(${printToken(currentToken)}`;
        str += `(${this._makeString()}))`;
      } else {
        str += printToken(currentToken);
        str += `(${this._makeString()})`;
      }
    } else if (type === TokenType.VALUE && currentToken.value < 0) {
      str += `(${printToken(currentToken)})`;
    } else {
      str += printToken(currentToken);
    }

    return str;
  }

  evaluateFunction(var1, var2, var3) {
    this.var1 = var1;
    this.var2 = var2;
    this.var3 = var3;
    this.readLocation = 0;

    return this._evaluateRec();
  }

  _evaluateRec() {
    const currentToken = this.tokens[this.readLocation];
    this.readLocation++;

    switch (currentToken.type) {
      case TokenType.VARIABLE1:
        return this.var1;
      case TokenType.VARIABLE2:
        return this.var2;
      case TokenType.VARIABLE3:
        return this.var3;
      case TokenType.VALUE:
        return currentToken.value;
      case TokenType.ADD:
        return this._evaluateRec() + this._evaluateRec();
      case TokenType.SUBTRACT:
        return -this._evaluateRec();
      case TokenType.MULTIPLY:
        return this._evaluateRec() * this._evaluateRec();
      case TokenType.DIVIDE:
        return this._evaluateRec() / this._evaluateRec();
      case TokenType.SQRT:
        return Math.sqrt(this._evaluateRec());
      case TokenType.LOG:
        return Math.log10(this._evaluateRec());
      case TokenType.ABS:
        return Math.abs(this._evaluateRec());
      case TokenType.SIN:
        return Math.sin(this._evaluateRec());
      case TokenType.COS:
        return Math.cos(this._evaluateRec());
      case TokenType.TAN:
        return Math.tan(this._evaluateRec());
      case TokenType.POW:
        return Math.pow(this._evaluateRec(), this._evaluateRec());
      case TokenType.LN:
        return Math.log(this._evaluateRec());
      default:
        return 0;
    }
  }
}
