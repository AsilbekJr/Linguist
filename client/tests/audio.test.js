import { test } from 'node:test';
import assert from 'node:assert/strict';

const setupSpeech = (t) => {
  const spoken = [];
  globalThis.window = { speechSynthesis: { getVoices: () => [], cancel() {}, speak: message => spoken.push(message.text) } };
  globalThis.speechSynthesis = window.speechSynthesis;
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  t.after(() => { delete globalThis.window; delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return spoken;
};

test('rapid playback requests replace pending speech instead of queuing duplicates', async (t) => {
  const spoken = setupSpeech(t);
  const { playTTSAudio } = await import('../src/utils/audio.js');
  playTTSAudio('First sentence');
  playTTSAudio('Second sentence');
  t.mock.timers.tick(60);
  assert.deepEqual(spoken, ['Second sentence']);
});

test('stopping speech before playback prevents audio after leaving a card', async (t) => {
  const spoken = setupSpeech(t);
  const { playTTSAudio, stopTTSAudio } = await import('../src/utils/audio.js');
  playTTSAudio('Previous card');
  stopTTSAudio();
  t.mock.timers.tick(60);
  assert.deepEqual(spoken, []);
});

test('cleanup from a previous card cannot stop a newer playback', async (t) => {
  const spoken = setupSpeech(t);
  const { playTTSAudio } = await import('../src/utils/audio.js');
  const cleanup = playTTSAudio('Previous card');
  playTTSAudio('Current card');
  cleanup();
  t.mock.timers.tick(60);
  assert.deepEqual(spoken, ['Current card']);
});
