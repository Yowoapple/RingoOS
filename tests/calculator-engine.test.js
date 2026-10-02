import { describe, expect, it } from 'vitest';
import { createCalculator, evaluate, formatNumber } from '../src/apps/calculator/engine.js';

function press(calc, keys) {
  let last = null;
  keys.split(' ').forEach((key) => {
    if (/^\d$/.test(key)) calc.digit(key);
    else if (key === '.') calc.decimal();
    else if (['+', '-', '*', '/'].includes(key)) calc.operator(key);
    else if (key === '=') last = calc.equals();
    else if (key === '%') calc.percent();
    else if (key === '±') calc.toggleSign();
    else if (key === '⌫') calc.backspace();
    else if (key === 'C') calc.clear();
  });
  return last;
}

describe('evaluate', () => {
  it('multiplies and divides before adding and subtracting', () => {
    expect(evaluate([12, '+', 3, '*', 2])).toBe(18);
    expect(evaluate([2, '*', 3, '+', 4, '*', 5])).toBe(26);
    expect(evaluate([10, '-', 4, '/', 2, '-', 1])).toBe(7);
  });

  it('hides floating point noise and refuses division by zero', () => {
    expect(evaluate([0.1, '+', 0.2])).toBe(0.3);
    expect(() => evaluate([1, '/', 0])).toThrow();
  });
});

describe('formatNumber', () => {
  it('groups thousands and uses a real minus sign', () => {
    expect(formatNumber(1234567.5)).toBe('1,234,567.5');
    expect(formatNumber(-42)).toBe('−42');
  });

  it('switches to scientific notation at the extremes', () => {
    expect(formatNumber(1e16)).toBe('1e16');
    expect(formatNumber(1.5e-12)).toBe('1.5e-12');
  });
});

describe('calculator', () => {
  it('shows the whole expression and evaluates with precedence', () => {
    const calc = createCalculator();
    press(calc, '1 2 + 3 *');
    expect(calc.view()).toMatchObject({ expression: '12 + 3 ×', display: '3', pending: '*' });
    const done = press(calc, '2 =');
    expect(done).toEqual({ expression: '12 + 3 × 2', result: 18 });
    expect(calc.view()).toMatchObject({ expression: '12 + 3 × 2 =', display: '18' });
  });

  it('replaces an operator pressed twice and repeats the last step on equals', () => {
    const calc = createCalculator();
    press(calc, '5 + * 2 =');
    expect(calc.view().display).toBe('10');
    press(calc, '=');
    expect(calc.view().display).toBe('20');
  });

  it('continues from a result and starts fresh on a new digit', () => {
    const calc = createCalculator();
    press(calc, '6 * 7 = - 2 =');
    expect(calc.view().display).toBe('40');
    press(calc, '9');
    expect(calc.view()).toMatchObject({ expression: '', display: '9' });
  });

  it('treats percent like a phone calculator', () => {
    const calc = createCalculator();
    press(calc, '2 0 0 + 1 0 % =');
    expect(calc.view().display).toBe('220');
    const other = createCalculator();
    press(other, '5 0 * 1 0 % =');
    expect(other.view().display).toBe('5');
  });

  it('reports division by zero and recovers on the next digit', () => {
    const calc = createCalculator();
    press(calc, '8 / 0 =');
    expect(calc.view().error).toBe('除數不能是 0');
    press(calc, '3');
    expect(calc.view()).toMatchObject({ error: null, display: '3' });
  });

  it('edits the entry with sign, backspace and clear', () => {
    const calc = createCalculator();
    press(calc, '1 2 3 4 ±');
    expect(calc.view().display).toBe('−1,234');
    press(calc, '⌫ ⌫');
    expect(calc.view().display).toBe('−12');
    expect(calc.view().canClearEntry).toBe(true);
    press(calc, '+ 9 C');
    expect(calc.view()).toMatchObject({ expression: '−12 +', display: '0' });
    press(calc, 'C');
    expect(calc.view()).toMatchObject({ expression: '', display: '0' });
  });

  it('keeps decimals while typing', () => {
    const calc = createCalculator();
    press(calc, '. 5 0');
    expect(calc.view().display).toBe('0.50');
    press(calc, '+ 1 . 2 5 =');
    expect(calc.view().display).toBe('1.75');
  });
});
