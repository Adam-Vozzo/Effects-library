import './styles/app.css';
import { App } from './app';

const mount = document.getElementById('app')!;
try {
  const app = new App(mount);
  void app.start();
  (window as unknown as { __app: App }).__app = app;
} catch (e) {
  mount.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'fatal';
  box.innerHTML = '<h1>Real-time effects are not available</h1><p></p>';
  box.querySelector('p')!.textContent = String((e as Error)?.message ?? e) + ' — this app needs a browser with WebGL 2 (Chrome, Edge, Firefox or Safari 15+).';
  mount.append(box);
  console.error(e);
}
