import { describe, expect, it } from 'vitest';
import { parseTask } from '../src/apps/calendar/parse.js';

describe('parseTask', () => {
  it('reads a clock time at either end', () => {
    expect(parseTask('14:30 看牙醫')).toEqual({ time: '14:30', text: '看牙醫' });
    expect(parseTask('看牙醫 9:05')).toEqual({ time: '09:05', text: '看牙醫' });
    expect(parseTask('開會 18：00')).toEqual({ time: '18:00', text: '開會' });
  });

  it('reads spoken Chinese times', () => {
    expect(parseTask('下午3點半 開會')).toEqual({ time: '15:30', text: '開會' });
    expect(parseTask('晚上 8 點 15 分 打電話')).toEqual({ time: '20:15', text: '打電話' });
    expect(parseTask('早上7點跑步')).toEqual({ time: '07:00', text: '跑步' });
    expect(parseTask('中午12點 午餐')).toEqual({ time: '12:00', text: '午餐' });
  });

  it('leaves text without a time alone', () => {
    expect(parseTask('  繳電費  ')).toEqual({ time: null, text: '繳電費' });
    expect(parseTask('買 3 顆蛋')).toEqual({ time: null, text: '買 3 顆蛋' });
    expect(parseTask('25:00 x')).toEqual({ time: null, text: '25:00 x' });
  });
});
