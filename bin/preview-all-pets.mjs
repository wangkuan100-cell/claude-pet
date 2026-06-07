import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as spriteSource from '../widget/sprite-source.js';
import { attachSpriteAssets } from '../widget/sprite-paint-assets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const rendererRoot = path.join(projectRoot, 'widget', 'renderer');
const assetsDir = path.join(projectRoot, 'assets');
const port = Number(process.env.PORT || 4322);
const host = process.env.HOST || '127.0.0.1';

const pets = [
  { key: 'phoenix/legendary', label: '凤凰', mark: '🔥' },
  { key: 'dragon/legendary', label: '龙王', mark: '🐉' },
  { key: 'kitsune/legendary', label: '九尾狐', mark: '✨' },
  { key: 'cerberus/legendary', label: '地狱犬', mark: '🐺' },
  { key: 'sphinx/legendary', label: '狮身兽', mark: '🦁' },
  { key: 'golem/legendary', label: '魔像王', mark: '💎' },
];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function cleanPath(urlPath) {
  return decodeURIComponent(new URL(urlPath, 'http://localhost').pathname).replace(/^\/+/, '');
}

function petByKey(key) {
  return pets.find((pet) => pet.key === key) || pets[0];
}

function fixtureFor(key) {
  const pet = petByKey(key);
  const sprite = attachSpriteAssets({ key: pet.key, base: pet.mark }, spriteSource, assetsDir);
  return {
    expression: 'happy',
    sprite,
    panel: {
      name: pet.label,
      level: 6,
      stage: 'legendary',
      xp: 5200,
      xpToNext: 1100,
      xpPct: 72,
      mood: 92,
      project: { repo: 'claude-pet', contextPct: 41, cost: '0.00' },
      achievements: ['dragonbones-rig'],
    },
  };
}

function rootHtml() {
  const cards = pets.map((pet, index) => `
    <section class="card">
      <div class="meta">
        <strong>${pet.mark} ${pet.label}</strong>
        <span>${pet.key}</span>
      </div>
      <iframe src="/pet.html?key=${encodeURIComponent(pet.key)}&delay=${index * 420}" title="${pet.label}"></iframe>
    </section>
  `).join('');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Code Pet · all legendary preview</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f7f4; color: #1f2328; }
    body { padding: 18px; }
    header { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin: 0 auto 14px; max-width: 1120px; }
    h1 { font-size: 18px; line-height: 1.2; margin: 0; font-weight: 760; }
    .note { color: #6a6f76; font-size: 12px; text-align: right; }
    .grid { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .card { background: #fff; border: 1px solid rgba(31,35,40,.09); border-radius: 8px; overflow: hidden; min-height: 270px; box-shadow: 0 1px 3px rgba(31,35,40,.05); }
    .meta { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px 0; font-size: 13px; }
    .meta span { color: #6a6f76; font-size: 11px; }
    iframe { display: block; width: 100%; height: 245px; border: 0; background: #fff; }
    @media (max-width: 860px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } header { align-items: start; flex-direction: column; } .note { text-align: left; } }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>六系 legendary 宠物同屏预览</h1>
    <div class="note">每只独立跑 Pet3D · DragonBones whole-sprite rig · 轻量眼睛/眨眼</div>
  </header>
  <main class="grid">${cards}</main>
</body>
</html>`;
}

async function petHtml(url) {
  const key = url.searchParams.get('key') || 'phoenix/legendary';
  const delay = Number(url.searchParams.get('delay') || 0);
  const indexPath = path.join(rendererRoot, 'index.html');
  let html = await fs.readFile(indexPath, 'utf8');
  const inject = `<script>window.__FIXTURE__=${JSON.stringify(fixtureFor(key))};</script>`;
  html = html.replace('<script src="vendor/three.min.js"></script>', `${inject}
    <script src="vendor/three.min.js"></script>`);
  html = html.replace('</head>', `<style>
    html, body { width: 100%; height: 100%; background: #fff; }
    #app { width: 100vw; height: 230px; align-items: center; justify-content: center; }
    #stage3d { width: 220px; height: 220px; }
    #particles, #bubble, #panel, #toast, #celebrate { display: none !important; }
  </style></head>`);
  html = html.replace(
    '<script src="pet.js"></script>',
    `<script src="pet.js"></script>
    <script>
      setTimeout(function(){
        if (!window.Pet3D) return;
        if (window.Pet3D.setMood) window.Pet3D.setMood('happy');
        if (window.Pet3D.setMoving) window.Pet3D.setMoving(1);
      }, ${Math.max(0, delay)});
      setInterval(function(){
        if (!window.Pet3D) return;
        if (window.Pet3D.setMoving) window.Pet3D.setMoving(1);
        setTimeout(function(){ if (window.Pet3D && window.Pet3D.playAction) window.Pet3D.playAction('hop'); }, 1400);
        setTimeout(function(){ if (window.Pet3D && window.Pet3D.playAction) window.Pet3D.playAction('blink'); }, 2500);
        setTimeout(function(){ if (window.Pet3D && window.Pet3D.playAction) window.Pet3D.playAction('fly'); }, 3400);
      }, 5400);
    </script>`,
  );
  return html;
}

async function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const body = await fs.readFile(filePath);
  res.writeHead(200, {
    'content-type': mimeTypes[ext] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}`);
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': mimeTypes['.html'], 'cache-control': 'no-store' });
      res.end(rootHtml());
      return;
    }
    if (url.pathname === '/pet.html') {
      res.writeHead(200, { 'content-type': mimeTypes['.html'], 'cache-control': 'no-store' });
      res.end(await petHtml(url));
      return;
    }
    const name = cleanPath(url.pathname);
    const base = name.startsWith('assets/') ? projectRoot : rendererRoot;
    const filePath = path.normalize(path.join(base, name));
    if (!filePath.startsWith(base)) throw new Error('invalid path');
    await serveFile(res, filePath);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

server.listen(port, host, () => {
  console.log(`code-pet all preview: http://${host}:${port}/`);
  for (const pet of pets) {
    const sprite = fixtureFor(pet.key).sprite;
    console.log(`${pet.key} animationMode=${sprite.animationMode} rig=${sprite.rig?.id || 'none'}`);
  }
});
