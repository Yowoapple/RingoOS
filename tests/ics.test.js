import { beforeEach, describe, expect, it } from 'vitest';
import { calendarText, effectiveDetail, escapeText, eventLines, fileName, qrSvg, triggerOf } from '../src/apps/calendar/ics.js';
import { Data } from '../src/core/data-model.js';

const NOW = new Date(Date.UTC(2026, 9, 2, 8, 30, 0));

describe('ics', () => {
  it('writes an all-day event that ends on the next day', () => {
    const lines = eventLines('2026-10-31', { id: 'a', text: '繳電費' }, { now: NOW });
    expect(lines).toContain('DTSTART;VALUE=DATE:20261031');
    expect(lines).toContain('DTEND;VALUE=DATE:20261101');
    expect(lines).toContain('DTSTAMP:20261002T083000Z');
    expect(lines.some((line) => line.startsWith('BEGIN:VALARM'))).toBe(false);
  });

  it('adds duration and a default fifteen minute alarm to timed events', () => {
    const lines = eventLines('2026-10-02', { id: 'b', text: '看牙醫', time: '23:30' }, { now: NOW });
    expect(lines).toContain('DTSTART:20261002T233000');
    expect(lines).toContain('DTEND:20261003T000000');
    expect(lines).toContain('TRIGGER:-PT15M');
  });

  it('respects chosen duration, reminder and the all-day choice', () => {
    expect(eventLines('2026-10-02', { text: 'x', time: '09:00', durationChoice: '90', reminderLead: '1D' }, { now: NOW })).toEqual(expect.arrayContaining(['DTEND:20261002T103000', 'TRIGGER:-P1D']));
    expect(eventLines('2026-10-02', { text: 'x', time: '09:00', durationChoice: 'allday' }, { now: NOW })).toContain('DTSTART;VALUE=DATE:20261002');
  });

  it('reads legacy duration and reminder fields', () => {
    expect(effectiveDetail({ time: '10:00', durationMinutes: 60, reminderMinutes: null })).toMatchObject({ durationChoice: '60', reminderLead: 'none' });
    expect(effectiveDetail({ time: '10:00', reminderMinutes: 30 }).reminderLead).toBe('30M');
  });

  it('escapes text and maps triggers', () => {
    expect(escapeText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
    expect(triggerOf('2H')).toBe('-PT2H');
    expect(triggerOf('1W')).toBe('-P1W');
    expect(triggerOf('none')).toBe(null);
  });

  it('wraps several events into one calendar with CRLF', () => {
    const text = calendarText([{ dateKey: '2026-10-02', task: { id: 'a', text: '一' } }, { dateKey: '2026-10-03', task: { id: 'b', text: '二' } }], { now: NOW });
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text.endsWith('END:VCALENDAR')).toBe(true);
  });

  it('builds safe file names and a QR with a quiet zone', () => {
    expect(fileName('a/b:c?', '2026-10-02')).toBe('abc-2026-10-02.ics');
    expect(fileName('   ', '2026-10-02')).toBe('代辦事項-2026-10-02.ics');
    expect(qrSvg('hello')).toMatch(/^<svg viewBox="0 0 25 25"/);
  });
});

describe('tasks', () => {
  beforeEach(() => {
    Data.replaceStore(Data.createDefaultStore());
  });

  it('restores a removed task at its old position once', () => {
    ['一', '二', '三'].forEach((text) => Data.addTask('2026-10-02', text));
    const task = { ...Data.getDayTasks('2026-10-02')[1] };
    const index = Data.getTaskIndex('2026-10-02', task.id);
    Data.removeTask('2026-10-02', task.id);
    expect(Data.restoreTask('2026-10-02', task, index)).toBe(true);
    expect(Data.restoreTask('2026-10-02', task, index)).toBe(false);
    expect(Data.getDayTasks('2026-10-02').map((t) => t.text)).toEqual(['一', '二', '三']);
  });

  it('returns the new task id and stamps creation time', () => {
    const id = Data.addTask('2026-10-02', '買菜', '18:00');
    const [task] = Data.getDayTasks('2026-10-02');
    expect(task.id).toBe(id);
    expect(typeof task.createdAt).toBe('number');
  });
});
