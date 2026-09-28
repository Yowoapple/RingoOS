import { describe, expect, it } from 'vitest';
import { CalculatorEngine } from '../src/apps/calculator/calculator.js';

const { formatNumber, createCalculatorState } = CalculatorEngine;

function press(calc, keys) {
  keys.split(' ').forEach((key) => {
    if (/^\d$/.test(key)) calc.inputDigit(key);
    else if (key === '.') calc.inputDecimal();
    else if (key === '=') calc.equals();
    else if (key === '%') calc.percent();
    else if (key === '+/-') calc.toggleSign();
    else if (key === 'back') calc.backspace();
    else calc.inputOperator(key);
  });
  return calc.getDisplay();
}

describe('formatNumber', () => {
  it('hides floating point noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });

  it('switches to scientific notation for very large or small numbers', () => {
    expect(formatNumber(123456789012345)).toBe('1.23457e14');
    expect(formatNumber(0.000000001234)).toBe('1.23400e-9');
  });

  it('reports non-finite results as an error', () => {
    expect(formatNumber(Infinity)).toBe('Error');
  });
});

describe('calculator state machine', () => {
  it('evaluates chained operations left to right', () => {
    expect(press(createCalculatorState(), '2 + 3 * 4 =').result).toBe('20');
  });

  it('keeps decimal results clean', () => {
    expect(press(createCalculatorState(), '0 . 1 + 0 . 2 =').result).toBe('0.3');
  });

  it('shows the pending expression', () => {
    expect(press(createCalculatorState(), '7 *')).toEqual({ expression: '7 ×', result: '7', isError: false });
  });

  it('reports division by zero and recovers on the next digit', () => {
    const calc = createCalculatorState();
    expect(press(calc, '8 / 0 =')).toEqual({ expression: '', result: '除數不能是 0', isError: true });
    expect(press(calc, '5').result).toBe('5');
  });

  it('supports percent, sign toggle and backspace', () => {
    expect(press(createCalculatorState(), '5 0 %').result).toBe('0.5');
    expect(press(createCalculatorState(), '4 2 +/-').result).toBe('-42');
    expect(press(createCalculatorState(), '1 2 3 back').result).toBe('12');
  });
});
