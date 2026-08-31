import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const PAGES = ['index.html', 'about.html', 'privacy.html'];
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('every page exists', () => {
  for (const p of PAGES) assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), `${p} missing`);
});

test('no page loads the Tailwind Play CDN', () => {
  for (const p of PAGES) {
    assert.ok(!read(p).includes('cdn.tailwindcss.com'),
      `${p} still references the runtime CDN`);
  }
});

test('no page carries inline style or script blocks', () => {
  for (const p of PAGES) {
    const html = read(p);
    assert.ok(!/<style[\s>]/i.test(html), `${p} has an inline <style> block`);
    assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(html), `${p} has an inline <script> block`);
  }
});

test('every page has a title, description and canonical', () => {
  for (const p of PAGES) {
    const html = read(p);
    assert.match(html, /<title>[^<]{10,70}<\/title>/, `${p} title missing or wrong length`);
    assert.match(html, /<meta name="description" content="[^"]{50,160}"/, `${p} description missing or wrong length`);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+"/, `${p} canonical missing`);
  }
});

test('every page has Open Graph tags for Discord unfurling', () => {
  for (const p of PAGES) {
    const html = read(p);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      assert.ok(html.includes(`property="${tag}"`), `${p} missing ${tag}`);
    }
    assert.ok(html.includes('name="twitter:card"'), `${p} missing twitter:card`);
  }
});

const ROUTE_BY_PAGE = { 'index.html': '/', 'about.html': '/about', 'privacy.html': '/privacy' };

test('og:url and canonical resolve to each page\'s own route, not a shared or wrong one', () => {
  const titles = [];
  for (const p of PAGES) {
    const html = read(p);
    const route = ROUTE_BY_PAGE[p];
    const expectedUrl = `https://lords-trap-sim.pages.dev${route}`;

    const ogUrlMatch = html.match(/<meta property="og:url" content="([^"]+)"/);
    assert.ok(ogUrlMatch, `${p} missing og:url content`);
    assert.equal(ogUrlMatch[1], expectedUrl, `${p} og:url should be ${expectedUrl}, got ${ogUrlMatch[1]}`);

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonicalMatch, `${p} missing canonical href`);
    assert.equal(canonicalMatch[1], expectedUrl, `${p} canonical should be ${expectedUrl}, got ${canonicalMatch[1]}`);

    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    assert.ok(ogTitleMatch, `${p} missing og:title content`);
    titles.push(ogTitleMatch[1]);
  }
  assert.ok(new Set(titles).size > 1, 'og:title must not be identical across all pages');
});

test('the tip jar never claims a running cost', () => {
  const banned = /server cost|hosting cost|pay the server|keep the lights|running costs/i;
  for (const p of PAGES) {
    assert.ok(!banned.test(read(p)), `${p} claims a cost the site does not have`);
  }
});

test('no ad or consent scripts ship in phase 1', () => {
  const banned = /adsbygoogle|googlesyndication|pagead|funding-choices/i;
  for (const p of PAGES) assert.ok(!banned.test(read(p)), `${p} contains ad code`);
});

test('robots.txt and sitemap.xml are consistent', () => {
  const robots = read('robots.txt');
  const sitemap = read('sitemap.xml');
  assert.match(robots, /Sitemap: https:\/\/\S+\/sitemap\.xml/);
  for (const route of ['/', '/about', '/privacy']) {
    assert.ok(sitemap.includes(`<loc>https://lords-trap-sim.pages.dev${route}</loc>`),
      `sitemap missing ${route}`);
  }
});
