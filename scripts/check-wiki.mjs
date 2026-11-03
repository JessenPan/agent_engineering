import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'wiki/content.json'), 'utf8'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const projectDisplayTitle = project => `${project.id} ${project.title}-Project`;
const sourceAnchor = source => source.kind === 'paper' ? `paper-${source.id.replaceAll('.', '-')}` : `source-${source.kind}-${encodeURIComponent(source.title).replaceAll('%', '')}`;
const mainContent = html => html.split('<main id="main"')[1].split('</main>')[0];
const validStates = new Set(['not_started', 'in_progress', 'done', 'planned', 'queued', 'reading', 'read', 'reproduced']);
const sourceRecords = content.categories.flatMap(category => category.sources.map(source => ({ source, category })));
const sourceUrls = new Set(sourceRecords.map(record => record.source.url));
const ownerUnit = (category, source) => category.units.find(unit => unit.resources.includes(source.url));
const ownerPage = (category, source) => {
  const unit = ownerUnit(category, source);
  return category.pageLayout === 'subtopics' && unit
    ? `${category.dir}/subtopics/${unit.id.replace('.', '-')}.html`
    : `${category.dir}/index.html`;
};
const pages = ['index.html', 'sources.html', 'bad-cases.html', 'projects/index.html', `${content.sharedProject.dir}/index.html`, ...content.categories.flatMap(category => [
  `${category.dir}/index.html`,
  `${category.dir}/projects/index.html`,
  `${category.dir}/projects/${category.project.id}.html`,
  ...(category.pageLayout === 'subtopics' ? category.units.flatMap(unit => [
    `${category.dir}/subtopics/${unit.id.replace('.', '-')}.html`,
    `${category.dir}/subtopics/${unit.id.replace('.', '-')}/projects/index.html`,
    `${category.dir}/subtopics/${unit.id.replace('.', '-')}/projects/${unit.exercise.id.replace('.', '-')}.html`
  ]) : [])
])];

assert.equal(content.categories.length, 10, 'The learning map must contain ten categories.');
assert.equal(new Set(content.categories.map(category => category.dir)).size, 10);
assert(fs.existsSync(path.join(root, 'wiki/learning-log.md')), 'Learning records need a durable Markdown file.');
assert(!content.categories.some(category => fs.existsSync(path.join(root, category.dir, 'papers/index.html'))), 'Standalone papers pages must not be generated.');
for (const category of content.categories) {
  assert(category.units.length > 0);
  assert.match(category.project.id, new RegExp(`^${category.id}-P[1-9]\\d*$`));
  const assigned = new Set([...category.sharedSourceUrls, ...category.units.flatMap(unit => unit.resources)]);
  assert(category.sources.every(source => assigned.has(source.url)), `Unassigned category source: ${category.id}`);
  for (const unit of category.units) {
    assert.match(unit.id, new RegExp(`^${category.id}\\.\\d+$`));
    assert.match(unit.exercise.id, new RegExp(`^${unit.id.replace('.', '\\.')}-P[1-9]\\d*$`));
    assert(['not_started', 'in_progress', 'done'].includes(unit.status));
    assert(unit.status !== 'done' || unit.evidenceLink, `Completed unit lacks evidence: ${unit.id}`);
    assert(unit.resources.every(url => sourceUrls.has(url)), `Unknown source in ${unit.id}`);
    assert(unit.practiceNote && unit.exercise.title && unit.exercise.goal, `Incomplete subtopic: ${unit.id}`);
    assert(['planned', 'in_progress', 'done'].includes(unit.exercise.status));
    assert(unit.exercise.status !== 'done' || (unit.exercise.repository && unit.exercise.results), `Completed exercise lacks results: ${unit.id}`);
  }
  for (const source of category.sources) {
    assert(validStates.has(source.status));
    assert.equal(new URL(source.url).protocol, 'https:');
    if (['read', 'reproduced'].includes(source.status)) assert(source.notes, `Read source lacks notes: ${source.title}`);
  }
}

const documents = new Map();
for (const page of pages) {
  const file = path.join(root, page);
  assert(fs.existsSync(file), `Missing generated page: ${page}`);
  const html = fs.readFileSync(file, 'utf8');
  assert(html.startsWith('<!doctype html>'), page);
  assert(html.includes('<html lang="zh-CN">'), page);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `One h1 required: ${page}`);
  assert(html.includes('<main id="main"'), page);
  assert(!html.includes('papers/index.html'), `Standalone papers route remains in ${page}`);
  assert(!html.includes('学习记录'), `Learning records remain visible in ${page}`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate IDs: ${page}`);
  documents.set(page, { html, ids: new Set(ids) });
}

const checkSourcesOnPage = (category, page) => {
  const document = documents.get(page);
  assert(document, `Missing owner page for sources: ${page}`);
  for (const source of category.sources.filter(item => ownerPage(category, item) === page)) {
    assert(document.ids.has(sourceAnchor(source)), `Missing source note anchor: ${page}#${sourceAnchor(source)}`);
    for (const value of [source.title, source.url, source.question, source.verification].filter(Boolean)) {
      assert(document.html.includes(escape(value)), `Source note lost: ${category.id}/${source.title}`);
    }
  }
};

for (const category of content.categories) {
  const categoryPage = `${category.dir}/index.html`;
  const categoryDocument = documents.get(categoryPage);
  const projectIndexPath = `${category.dir}/projects/index.html`;
  const projectDetailPath = `${category.dir}/projects/${category.project.id}.html`;
  const projectIndex = documents.get(projectIndexPath);
  const projectDetail = documents.get(projectDetailPath);
  const summaryBody = mainContent(projectIndex.html);
  const detailBody = mainContent(projectDetail.html);
  assert(summaryBody.includes(`href="${category.project.id}.html"`), `Project summary lacks detail link: ${category.id}`);
  assert(summaryBody.includes(escape(projectDisplayTitle(category.project))), `Project title missing from summary: ${category.id}`);
  assert(!summaryBody.includes('eval-architecture') && !summaryBody.includes('record-fields') && !summaryBody.includes('log-entry'), `Project details duplicated in summary: ${category.id}`);
  assert(detailBody.includes(escape(projectDisplayTitle(category.project))), `Project detail title missing: ${category.id}`);
  assert(detailBody.includes('href="index.html"') && detailBody.includes('href="../index.html'), `Project detail navigation missing: ${category.id}`);
  for (const source of category.sources) assert(documents.get(ownerPage(category, source)).ids.has(sourceAnchor(source)), `Source owner missing: ${source.title}`);
  if (category.pageLayout !== 'subtopics') assert(categoryDocument.ids.has('source-notes'), `Category source notes missing: ${category.id}`);
  if (category.project.architecture) {
    assert(projectDetail.ids.has('architecture-sources'), `Architecture notes missing: ${category.id}`);
    for (const source of category.project.architecture.sources) {
      assert(projectDetail.ids.has(`architecture-source-${source.id}`), `Architecture source missing: ${category.id}/${source.id}`);
      assert(detailBody.includes(escape(source.title)) && detailBody.includes(escape(source.supports)), `Architecture evidence lost: ${category.id}/${source.id}`);
    }
  }
  assert(categoryDocument.html.includes('class="subtopic-table"'));
  for (const unit of category.units) {
    const suffix = unit.id.replace('.', '-');
    assert(categoryDocument.ids.has(`subtopic-${suffix}`));
    if (category.pageLayout === 'subtopics') {
      const topicPath = `${category.dir}/subtopics/${suffix}.html`;
      const topic = documents.get(topicPath);
      for (const id of ['completion', 'practice', 'papers', 'implementations', 'references', 'source-notes', 'exercise', 'experiments']) assert(topic.ids.has(id), `Missing subtopic section: ${topicPath}#${id}`);
      assert(topic.html.includes('class="source-entry"') || /暂无直接对应|待补充对应|本页资料已在/.test(topic.html), `Subtopic source notes missing: ${unit.id}`);
      for (const source of category.sources.filter(item => ownerPage(category, item) === topicPath)) assert(topic.ids.has(sourceAnchor(source)), `Subtopic source anchor missing: ${unit.id}/${source.title}`);
      assert(topic.html.includes(`href="${suffix}.html" aria-current="page"`));
      const projectPath = `${category.dir}/subtopics/${suffix}/projects/${unit.exercise.id.replace('.', '-')}.html`;
      const project = documents.get(projectPath);
      assert(project && project.html.includes(`href="../../${suffix}.html"`), `Exercise page navigation missing: ${unit.id}`);
      assert(project.ids.has('references'));
      assert(!mainContent(project.html).includes('papers/index.html'));
    }
  }
  const ownerPages = new Set(category.sources.map(source => ownerPage(category, source)));
  for (const page of ownerPages) checkSourcesOnPage(category, page);
}

for (const [page, document] of documents) {
  const categoryGroups = [...document.html.matchAll(/data-nav-category="([^"]+)"/g)];
  assert.equal(categoryGroups.length, 2 * content.categories.length, `Desktop/mobile category menus missing: ${page}`);
  const projectGroups = [...document.html.matchAll(/<details class="nav-project-group[^\"]*"/g)];
  assert.equal(projectGroups.length, 2 * (content.categories.length + 1), `Project menus missing: ${page}`);
  assert(!document.html.includes('nav-exercise-group') && !document.html.includes('<summary>练手项目</summary>'));
}

let checkedLinks = 0;
for (const [page, document] of documents) {
  for (const match of document.html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const target = match[1].replaceAll('&amp;', '&');
    if (/^https?:/.test(target)) continue;
    assert(!/^(?:javascript|data|file):/i.test(target), `Unsafe local target: ${page}: ${target}`);
    const url = new URL(target, `https://wiki.local/${page}`);
    const relativePath = decodeURIComponent(url.pathname.slice(1));
    const resolved = path.resolve(root, relativePath);
    assert(resolved.startsWith(root + path.sep), `Outside-root link: ${page}: ${target}`);
    assert(fs.existsSync(resolved), `Missing target: ${page}: ${target}`);
    if (url.hash) {
      const targetDocument = documents.get(relativePath);
      assert(targetDocument, `Unknown anchor document: ${relativePath}`);
      assert(targetDocument.ids.has(decodeURIComponent(url.hash.slice(1))), `Missing anchor: ${page}: ${target}`);
    }
    checkedLinks += 1;
  }
}

const category7 = documents.get('07-evaluation-and-observability/index.html').html;
for (const required of ['线上评估', '异步', 'Bad-case', 'A/B', '质量', '第十类']) assert(category7.includes(required), required);
const learningLog = fs.readFileSync(path.join(root, 'wiki/learning-log.md'), 'utf8');
for (const log of content.logs) assert(learningLog.includes(log.title), `Learning log missing: ${log.title}`);
console.log(`Verified ${pages.length} HTML pages, ${checkedLinks} local links/assets/anchors, inline source notes, hidden learning records, and durable Markdown logs.`);
