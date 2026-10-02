import { describe, expect, it } from 'vitest';
import { canonicalUrl, nextIndex, parseYouTube, previousIndex } from '../src/apps/radio/youtube.js';

describe('parseYouTube', () => {
  it('reads every common video link', () => {
    expect(parseYouTube('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toEqual({ kind: 'video', ref: 'jfKfPfyJRdk' });
    expect(parseYouTube('youtu.be/jfKfPfyJRdk?si=abc')).toEqual({ kind: 'video', ref: 'jfKfPfyJRdk' });
    expect(parseYouTube('https://youtube.com/shorts/jfKfPfyJRdk')).toEqual({ kind: 'video', ref: 'jfKfPfyJRdk' });
    expect(parseYouTube('https://www.youtube.com/live/jfKfPfyJRdk?feature=share')).toEqual({ kind: 'video', ref: 'jfKfPfyJRdk' });
    expect(parseYouTube('https://music.youtube.com/watch?v=jfKfPfyJRdk&list=PLabcdefghij')).toEqual({ kind: 'video', ref: 'jfKfPfyJRdk' });
    expect(parseYouTube('jfKfPfyJRdk')).toEqual({ kind: 'video', ref: 'jfKfPfyJRdk' });
  });

  it('reads playlists but not auto-generated mixes', () => {
    expect(parseYouTube('https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI')).toEqual({ kind: 'playlist', ref: 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' });
    expect(parseYouTube('https://www.youtube.com/playlist?list=RDjfKfPfyJRdk')).toBe(null);
  });

  it('rejects other sites and junk', () => {
    expect(parseYouTube('https://vimeo.com/123456')).toBe(null);
    expect(parseYouTube('https://notyoutube.com/watch?v=jfKfPfyJRdk')).toBe(null);
    expect(parseYouTube('hello world')).toBe(null);
    expect(parseYouTube('')).toBe(null);
  });

  it('builds canonical links for lookups', () => {
    expect(canonicalUrl({ kind: 'video', ref: 'jfKfPfyJRdk' })).toBe('https://www.youtube.com/watch?v=jfKfPfyJRdk');
    expect(canonicalUrl({ kind: 'playlist', ref: 'PLabc1234567' })).toBe('https://www.youtube.com/playlist?list=PLabc1234567');
  });
});

describe('queue order', () => {
  it('walks forward and stops or wraps at the end', () => {
    expect(nextIndex(3, 0)).toBe(1);
    expect(nextIndex(3, 2)).toBe(-1);
    expect(nextIndex(3, 2, { repeat: 'all' })).toBe(0);
    expect(nextIndex(3, 1, { repeat: 'one' })).toBe(1);
  });

  it('shuffles without repeating the current item', () => {
    for (let i = 0; i < 20; i += 1) expect(nextIndex(4, 2, { shuffle: true })).not.toBe(2);
    expect(nextIndex(4, 2, { shuffle: true, random: () => 0.99 })).toBe(3);
    expect(nextIndex(1, 0, { shuffle: true })).toBe(-1);
  });

  it('steps back and wraps only when looping', () => {
    expect(previousIndex(3, 2)).toBe(1);
    expect(previousIndex(3, 0)).toBe(0);
    expect(previousIndex(3, 0, { repeat: 'all' })).toBe(2);
  });
});
