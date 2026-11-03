import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'leo-wiki-test-'));
const original = fs.readFileSync(path.join(root, 'wiki/content.json'), 'utf8');

try {
  fs.mkdirSync(path.join(fixtureRoot, 'scripts'));
  fs.mkdirSync(path.join(fixtureRoot, 'wiki'));
  for (const file of ['build-wiki.mjs', 'check-wiki.mjs']) {
    fs.copyFileSync(path.join(root, 'scripts', file), path.join(fixtureRoot, 'scripts', file));
  }
  fs.cpSync(path.join(root, 'assets'), path.join(fixtureRoot, 'assets'), { recursive: true });
  fs.cpSync(path.join(root, '07-evaluation-and-observability', 'material'), path.join(fixtureRoot, '07-evaluation-and-observability', 'material'), { recursive: true });

  const content = JSON.parse(original);
  for (const category of content.categories) {
    for (const unit of category.units) {
      unit.status = 'not_started';
      unit.exercise.status = 'planned';
    }
    category.project.status = 'planned';
  }
  content.sharedProject.status = 'planned';

  const category = content.categories[0];
  const unit = category.units[0];
  unit.status = 'done';
  unit.evidenceLink = '#curriculum';
  unit.exercise.status = 'done';
  unit.exercise.repository = 'fixture exercise implementation';
  unit.exercise.results = 'Saved exercise result <script>alert(2)</script>';
  unit.exercise.experiments.push({ date: '2026-10-16', title: 'Saved exercise run', detail: 'Subtopic experiment evidence.' });
  category.project.status = 'done';
  category.project.repository = 'fixture implementation';
  category.project.results = 'Fixture checks passed.';
  category.project.experiments.push({ date: '2026-10-16', title: 'Saved experiment fixture', detail: 'Saved experiment result.' });
  category.sources[0].status = 'read';
  category.sources[0].notes = { conclusions: 'Saved paper note <script>alert(1)</script>', evidence: 'Saved evidence fixture.' };
  content.badCases.push({ id: 'fixture-case', date: '2026-10-16', origin: '模拟测试数据', title: 'Saved bad-case fixture', expected: 'Expected fixture outcome', actual: 'Actual fixture outcome' });
  content.logs.push({ date: '2026-10-16', kind: '实验', title: 'Saved learning log fixture', detail: 'Saved learning outcome.', categoryIds: [category.id] });

  const topicCategory = content.categories.find(item => item.pageLayout === 'subtopics');
  const topicUnit = topicCategory.units[0];
  const topicSuffix = topicUnit.id.replace('.', '-');
  const topicPath = `${topicCategory.dir}/subtopics/${topicSuffix}.html`;
  const authorPaper = {
    kind: 'paper',
    id: 'author-paper-fixture',
    title: 'Author manuscript fixture',
    authors: ['Fixture Author'],
    date: '2026-05-19',
    dateLabel: '作者稿日期',
    publication: '作者公开稿',
    url: 'https://example.org/manuscript.pdf',
    question: 'Non-arXiv citation',
    verification: 'Fixture source checked.',
    status: 'queued'
  };
  topicCategory.sources.push(authorPaper);
  topicUnit.resources.push(authorPaper.url);
  topicUnit.exercise.results = 'Preserved topic result <script>alert(3)</script>';
  topicUnit.exercise.experiments.push({ date: '2026-10-16', title: 'Topic experiment fixture', detail: 'Preserved topic experiment.' });
  topicUnit.exercise.architecture = structuredClone(topicCategory.project.architecture);
  topicUnit.exercise.architecture.sources[0].supports = 'Saved exercise architecture note <script>alert(4)</script>';
  topicUnit.evidenceLink = '#curriculum';
  content.logs.push({ date: '2026-10-16', kind: '讨论', title: 'Topic log fixture', detail: 'Preserved topic learning note.', categoryIds: [topicCategory.id], unitIds: [topicUnit.id] });

  fs.writeFileSync(path.join(fixtureRoot, 'wiki/content.json'), JSON.stringify(content));
  const build = () => execFileSync(process.execPath, ['scripts/build-wiki.mjs'], { cwd: fixtureRoot, encoding: 'utf8', stdio: 'pipe' });
  const read = file => fs.readFileSync(path.join(fixtureRoot, file), 'utf8');
  build();
  execFileSync(process.execPath, ['scripts/check-wiki.mjs'], { cwd: fixtureRoot, stdio: 'pipe' });

  const overview = read('index.html');
  const categoryPage = read(`${category.dir}/index.html`);
  const projects = read(`${category.dir}/projects/index.html`);
  const categoryProjectPath = `${category.dir}/projects/${category.project.id}.html`;
  const categoryProject = read(categoryProjectPath);
  const projectPath = `${topicCategory.dir}/subtopics/${topicSuffix}/projects/${topicUnit.exercise.id.replace('.', '-')}.html`;
  const projectListPath = `${topicCategory.dir}/subtopics/${topicSuffix}/projects/index.html`;
  const topic = read(topicPath);
  const projectRecord = read(projectPath);
  const learningLog = read('wiki/learning-log.md');

  assert(learningLog.includes('Saved learning log fixture') && learningLog.includes('Saved learning outcome.'), 'Learning logs are written to Markdown.');
  assert(!overview.includes('学习记录') && !categoryPage.includes('学习记录') && !topic.includes('学习记录'), 'Learning logs are hidden from HTML.');
  assert(!fs.existsSync(path.join(fixtureRoot, `${category.dir}/papers`)), 'Category papers directories are not generated.');
  assert(![overview, categoryPage, topic, categoryProject, projectRecord, read('sources.html')].some(html => html.includes('papers/index.html')), 'No generated page links to a standalone papers page.');

  assert(categoryPage.includes('class="source-entry"') && categoryPage.includes('Saved paper note &lt;script&gt;alert(1)&lt;/script&gt;'), 'Category source notes stay inline and escaped.');
  assert.equal((categoryPage.match(/<table class="source-table">/g) || []).length, 3, 'Category source notes use the same grouped tables.');
  assert(topic.includes('class="source-entry"') && topic.includes('Fixture Author · 作者稿日期 2026-05-19 · 作者公开稿'), 'Subtopic pages contain their own paper descriptions.');
  assert(!topic.includes('class="page-toc"') && !topic.includes('本页内容'), 'Pages do not render the right-side page marker.');
  assert(topic.includes('<h3 id="papers" class="source-group-title">论文</h3>') && topic.includes('<h3 id="implementations" class="source-group-title">开源项目</h3>') && topic.includes('<h3 id="references" class="source-group-title">官方参考</h3>'), 'Unified source section keeps clear source categories.');
  assert.equal((topic.match(/<table class="source-table">/g) || []).length, 3, 'Each source category is rendered as its own table.');
  assert(topic.includes('<th scope="col">资料</th>') && topic.includes('<th scope="col">关联子课题</th>') && topic.includes('<th scope="col">本页关注</th>') && topic.includes('<th scope="col">结论与边界</th>') && topic.includes('<th scope="col">核对信息</th>'), 'Source tables expose readable comparison columns.');
  assert(!topic.includes('<article class="source-entry"') && topic.includes('<tr class="source-entry"'), 'Source records are table rows on subtopic pages.');
  assert.equal((topic.match(/id="paper-author-paper-fixture"/g) || []).length, 1, 'A source appears once in its grouped table.');
  assert(topic.includes('2506.07982v1.pdf') && topic.includes('../material/2506.07982v1.pdf'), 'Local paper files stay linked from the owning subtopic page.');
  assert(topic.includes('id="paper-author-paper-fixture"') && !topic.includes('../papers/'), 'Subtopic source anchors resolve locally.');
  assert(read('sources.html').includes(`${topicCategory.dir}/subtopics/${topicSuffix}.html#paper-author-paper-fixture`), 'The compact global source index points to the owning page.');
  assert(!categoryProject.includes('class="reference-list"') && categoryProject.includes('Saved experiment result.'), 'Project details keep results without a repeated bibliography.');
  assert(projects.includes(`href="${category.project.id}.html"`) && !projects.includes('Saved experiment result.') && !projects.includes('Fixture checks passed.'), 'Project summaries contain only child summaries.');
  assert(projectRecord.includes('Preserved topic result &lt;script&gt;alert(3)&lt;/script&gt;') && projectRecord.includes('Preserved topic experiment.'), 'Independent project details retain implementation evidence.');
  assert(!topic.includes('Preserved topic result') && !topic.includes('Preserved topic experiment.'), 'Detailed project records are not duplicated on theory pages.');
  assert(read(projectListPath).includes(`href="${topicUnit.exercise.id.replace('.', '-')}.html"`), 'Subtopic project lists link to independent project pages.');
  assert(projectRecord.includes('class="eval-architecture"') && projectRecord.includes('Saved exercise architecture note &lt;script&gt;alert(4)&lt;/script&gt;'), 'Architecture and its evidence stay on the project detail page.');
  assert(!projects.includes('class="eval-architecture"'), 'Project summary does not duplicate architecture.');
  assert(topic.includes(`data-nav-category="${topicCategory.id}" open`) && topic.includes('data-nav-unit="07.1" open'), 'The current subtopic path remains expanded.');
  assert(read('bad-cases.html').includes('Saved bad-case fixture'), 'Bad-case records remain available.');

  const stable = new Map([['index.html', overview], [topicPath, topic], [projectPath, projectRecord], [categoryProjectPath, categoryProject], ['wiki/learning-log.md', learningLog]]);
  build();
  for (const [file, before] of stable) assert.equal(read(file), before, `Stable rebuild changed ${file}`);

  unit.exercise.repository = null;
  fs.writeFileSync(path.join(fixtureRoot, 'wiki/content.json'), JSON.stringify(content));
  assert.throws(build, /Completed exercises require code and results/);
  unit.exercise.repository = 'fixture exercise implementation';
  const resources = unit.resources;
  unit.resources = ['https://example.org/unknown-source'];
  fs.writeFileSync(path.join(fixtureRoot, 'wiki/content.json'), JSON.stringify(content));
  assert.throws(build, /Unknown source|Unassigned source/);
  unit.resources = resources;
  unit.status = 'done';
  unit.evidenceLink = null;
  fs.writeFileSync(path.join(fixtureRoot, 'wiki/content.json'), JSON.stringify(content));
  assert.throws(build, /Completed learning units require evidence/);
  assert.equal(fs.readFileSync(path.join(root, 'wiki/content.json'), 'utf8'), original, 'The real content file is not mutated by fixture tests.');
  console.log('Verified durable Markdown logs, inline source notes, no standalone papers pages, separate project summaries/details, escaped records, stable rebuilds, navigation state, and validation failures.');
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
