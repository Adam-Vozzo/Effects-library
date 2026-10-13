import { describe, expect, it } from 'vitest';
import { registerEffects } from '../../src/effects/registry';
import { Store, type AppState } from '../../src/state/store';
import { float } from '../../src/effects/helpers';

registerEffects([
  { id: 'test-a', name: 'A', category: 'Color', params: [float('amount', 'amount', 0, 1, 0.5)], shaders: { main: 'void main(){}' } },
  { id: 'test-b', name: 'B', category: 'Color', params: [], shaders: { main: 'void main(){}' } },
]);

function makeStore(): Store {
  const s: AppState = {
    project: { layers: [], crop: null, time: 0 },
    selectedLayerId: null,
    mode: 'effect',
    source: null,
    export: { format: 'png', quality: 0.9, bitDepth: 8, sizeMode: 'original', scale: 1, longSide: 4096, customW: 0, customH: 0 },
    previewMax: 0,
    playing: false,
    loop: true,
    duration: 5,
    theme: 'dark',
    compare: false,
    preview: null,
  };
  return new Store(s);
}

describe('Store', () => {
  it('adds layers with default params and selects them', () => {
    const st = makeStore();
    const l = st.addLayer('test-a')!;
    expect(st.state.project.layers).toHaveLength(1);
    expect(l.params.amount).toBe(0.5);
    expect(st.state.selectedLayerId).toBe(l.id);
    expect(st.addLayer('missing')).toBeNull();
  });

  it('undoes and redoes structural edits', () => {
    const st = makeStore();
    st.addLayer('test-a');
    st.addLayer('test-b');
    st.undo();
    expect(st.state.project.layers.map((l) => l.effectId)).toEqual(['test-a']);
    st.redo();
    expect(st.state.project.layers.map((l) => l.effectId)).toEqual(['test-a', 'test-b']);
  });

  it('coalesces rapid param edits into one history step', () => {
    const st = makeStore();
    const l = st.addLayer('test-a')!;
    st.setParam(l.id, 'amount', 0.6);
    st.setParam(l.id, 'amount', 0.7);
    st.setParam(l.id, 'amount', 0.8);
    st.commit();
    st.setParam(l.id, 'amount', 0.9);
    st.undo();
    expect(st.state.project.layers[0].params.amount).toBe(0.8);
    st.undo();
    expect(st.state.project.layers[0].params.amount).toBe(0.5);
  });

  it('moves, duplicates and removes layers', () => {
    const st = makeStore();
    const a = st.addLayer('test-a')!;
    const b = st.addLayer('test-b')!;
    st.moveLayer(b.id, 0);
    expect(st.state.project.layers.map((l) => l.id)).toEqual([b.id, a.id]);
    st.duplicateLayer(a.id);
    expect(st.state.project.layers).toHaveLength(3);
    st.removeLayer(a.id);
    expect(st.state.project.layers.some((l) => l.id === a.id)).toBe(false);
    expect(st.state.selectedLayerId).not.toBe(a.id);
  });

  it('fills missing params when applying a preset stack', () => {
    const st = makeStore();
    st.setLayers([{ effectId: 'test-a', params: {}, visible: true, opacity: 1, blend: 'normal' }]);
    expect(st.state.project.layers[0].params.amount).toBe(0.5);
  });
});
