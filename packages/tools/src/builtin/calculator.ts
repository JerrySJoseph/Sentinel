import { z } from 'zod';
import { JsonValue } from '@sentinel/contracts';
import { Tool, ToolContext } from '../types';
import { ToolUserError } from '../errors';

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | 'u+' | 'u-' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

const allowedCharsRe = /^[0-9+\-*/().\s]+$/;

function tokenize(expr: string): Token[] {
  if (!allowedCharsRe.test(expr)) {
    const bad = expr.match(/[^0-9+\-*/().\s]/);
    throw new ToolUserError('INVALID_CHAR', 'Expression contains invalid characters', {
      char: bad?.[0] ?? '?',
    });
  }

  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i += 1;
      continue;
    }
    if (c === '(') {
      tokens.push({ kind: 'lparen' });
      i += 1;
      continue;
    }
    if (c === ')') {
      tokens.push({ kind: 'rparen' });
      i += 1;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ kind: 'op', value: c });
      i += 1;
      continue;
    }
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i;
      let dotCount = 0;
      while (j < expr.length) {
        const ch = expr[j];
        if (ch === '.') {
          dotCount += 1;
          if (dotCount > 1) {
            throw new ToolUserError('INVALID_NUMBER', 'Invalid number literal', {
              token: expr.slice(i, j + 1),
            });
          }
          j += 1;
          continue;
        }
        if (ch >= '0' && ch <= '9') {
          j += 1;
          continue;
        }
        break;
      }
      const raw = expr.slice(i, j);
      if (raw === '.' || raw === '+.' || raw === '-.') {
        throw new ToolUserError('INVALID_NUMBER', 'Invalid number literal', { token: raw });
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        throw new ToolUserError('INVALID_NUMBER', 'Invalid number literal', { token: raw });
      }
      tokens.push({ kind: 'number', value: num });
      i = j;
      continue;
    }

    // Should be unreachable due to allowedCharsRe, but keep defensive.
    throw new ToolUserError('INVALID_CHAR', 'Expression contains invalid characters', { char: c });
  }

  return tokens;
}

type OpInfo = {
  precedence: number;
  associativity: 'left' | 'right';
  arity: 1 | 2;
};

const opInfo: Record<string, OpInfo> = {
  'u+': { precedence: 3, associativity: 'right', arity: 1 },
  'u-': { precedence: 3, associativity: 'right', arity: 1 },
  '*': { precedence: 2, associativity: 'left', arity: 2 },
  '/': { precedence: 2, associativity: 'left', arity: 2 },
  '+': { precedence: 1, associativity: 'left', arity: 2 },
  '-': { precedence: 1, associativity: 'left', arity: 2 },
};

function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const ops: Token[] = [];

  let prev: Token | undefined;
  for (const t of tokens) {
    if (t.kind === 'number') {
      output.push(t);
      prev = t;
      continue;
    }
    if (t.kind === 'lparen') {
      ops.push(t);
      prev = t;
      continue;
    }
    if (t.kind === 'rparen') {
      while (ops.length && ops[ops.length - 1].kind !== 'lparen') {
        output.push(ops.pop() as Token);
      }
      if (!ops.length) {
        throw new ToolUserError('MISMATCHED_PARENS', 'Mismatched parentheses');
      }
      ops.pop(); // pop lparen
      prev = t;
      continue;
    }
    if (t.kind === 'op') {
      // unary if at start or after operator or after lparen
      const isUnary = !prev || prev.kind === 'op' || prev.kind === 'lparen';
      let op: Token = t;
      if (isUnary && (t.value === '+' || t.value === '-')) {
        op = { kind: 'op', value: t.value === '+' ? 'u+' : 'u-' };
      } else if (isUnary) {
        throw new ToolUserError('INVALID_SYNTAX', 'Unexpected operator');
      }

      const info = opInfo[op.value];
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.kind !== 'op') break;
        const topInfo = opInfo[top.value];
        const shouldPop =
          (info.associativity === 'left' && info.precedence <= topInfo.precedence) ||
          (info.associativity === 'right' && info.precedence < topInfo.precedence);
        if (!shouldPop) break;
        output.push(ops.pop() as Token);
      }
      ops.push(op);
      prev = op;
      continue;
    }
  }

  while (ops.length) {
    const t = ops.pop() as Token;
    if (t.kind === 'lparen' || t.kind === 'rparen') {
      throw new ToolUserError('MISMATCHED_PARENS', 'Mismatched parentheses');
    }
    output.push(t);
  }

  return output;
}

function evalRpn(tokens: Token[]): number {
  const stack: number[] = [];
  for (const t of tokens) {
    if (t.kind === 'number') {
      stack.push(t.value);
      continue;
    }
    if (t.kind !== 'op') {
      throw new ToolUserError('INVALID_SYNTAX', 'Invalid expression');
    }
    const info = opInfo[t.value];
    if (info.arity === 1) {
      const a = stack.pop();
      if (a === undefined) throw new ToolUserError('INVALID_SYNTAX', 'Invalid expression');
      stack.push(t.value === 'u-' ? -a : +a);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) throw new ToolUserError('INVALID_SYNTAX', 'Invalid expression');
    switch (t.value) {
      case '+':
        stack.push(a + b);
        break;
      case '-':
        stack.push(a - b);
        break;
      case '*':
        stack.push(a * b);
        break;
      case '/':
        if (b === 0) throw new ToolUserError('DIVISION_BY_ZERO', 'Division by zero');
        stack.push(a / b);
        break;
      default:
        throw new ToolUserError('INVALID_SYNTAX', 'Invalid expression');
    }
  }
  if (stack.length !== 1) throw new ToolUserError('INVALID_SYNTAX', 'Invalid expression');
  return stack[0];
}

export const calculatorArgsSchema = z.object({ expression: z.string().min(1) }).strict();

export class CalculatorTool implements Tool<{ expression: string }> {
  readonly name = 'calculator';
  readonly description = 'Safely evaluate a math expression (+ - * / parentheses).';
  readonly risk = 'safe' as const;
  readonly argsSchema = calculatorArgsSchema;

  async execute(args: { expression: string }, _ctx: ToolContext): Promise<JsonValue> {
    const tokens = tokenize(args.expression);
    const rpn = toRpn(tokens);
    const result = evalRpn(rpn);
    return result;
  }
}

