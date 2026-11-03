import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'wiki/content.json'), 'utf8'));
const categories = data.categories;
const statuses = { not_started: '未开始', in_progress: '学习中', done: '已完成', planned: '计划中', queued: '待读', reading: '阅读中', read: '已读', reproduced: '已复现' };
const sourceKinds = { paper: '论文', official: '官方资料', github: 'GitHub 项目' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const allSources = categories.flatMap(category => category.sources.map(source => ({ ...source, category })));
const uniqueSources = [...new Map(allSources.map(source => [source.url, source])).values()];
const totalUnits = categories.reduce((sum, category) => sum + category.units.length, 0);
const completed = categories.reduce((sum, category) => sum + category.units.filter(unit => unit.status === 'done').length, 0);
const completedProjects = categories.filter(category => category.project.status === 'done').length + (data.sharedProject.status === 'done' ? 1 : 0);
const categoryStatus = category => category.units.every(unit => unit.status === 'done') ? 'done' : category.units.some(unit => unit.status !== 'not_started') ? 'in_progress' : 'not_started';
const link = (page, target) => path.posix.relative(path.posix.dirname(page), target) || path.posix.basename(target);
const anchor = source => source.kind === 'paper' ? `paper-${source.id.replaceAll('.', '-')}` : `source-${source.kind}-${encodeURIComponent(source.title).replaceAll('%', '')}`;
const categoryById = id => categories.find(category => category.id === id);
const badge = status => `<span class="status status-${escape(status)}">${escape(statuses[status])}</span>`;
const list = items => `<ul class="plain-list">${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`;
const progress = (done, total) => `<div class="progress"><progress value="${done}" max="${total}" aria-label="学习单元完成 ${done} / ${total}"></progress><span>${done} / ${total}</span></div>`;
const heading = (id, title) => `<h2 id="${id}">${title}</h2>`;
const external = (url, title) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(title)}<span class="external-mark" aria-hidden="true"> ↗</span><span class="sr-only">（新标签页）</span></a>`;
const unitAnchor = unit => `subtopic-${unit.id.replace('.', '-')}`;
const exerciseAnchor = unit => `exercise-${unit.id.replace('.', '-')}`;
const projectName = project => `${project.title}-Project`;
const projectDisplayTitle = project => `${project.id} ${projectName(project)}`;
const projectNavLabel = project => projectDisplayTitle(project);
const projectHeading = project => projectDisplayTitle(project);
const categoryProjectPage = category => `${category.dir}/projects/${category.project.id}.html`;
const subtopicPage = (category, unit) => `${category.dir}/subtopics/${unit.id.replace('.', '-')}.html`;
const unitProjectsDir = (category, unit) => `${category.dir}/subtopics/${unit.id.replace('.', '-')}/projects`;
const unitProjectsPage = (category, unit) => `${unitProjectsDir(category, unit)}/index.html`;
const unitProjectPage = (category, unit) => `${unitProjectsDir(category, unit)}/${unit.exercise.id.replace('.', '-')}.html`;
const architectureSourceId = (project, sourceId = '') => `project-${project.id.replaceAll('.', '-')}-architecture${sourceId ? `-${sourceId}` : ''}`;
const architectureSourceLink = (page, category, project, sourceId = '') => `#${sourceId ? `architecture-source-${sourceId}` : 'architecture-sources'}`;
const exerciseTarget = (page, category, unit) => category.pageLayout === 'subtopics' ? link(page, unitProjectPage(category, unit)) : `${link(page, `${category.dir}/index.html`)}#${exerciseAnchor(unit)}`;

const unitTarget = (category, unit) => category.pageLayout === 'subtopics' ? subtopicPage(category, unit) : `${category.dir}/index.html#${unitAnchor(unit)}`;
const sourceFor = url => allSources.find(source => source.url === url);
const sourceUnits = (category, source) => category.units.filter(unit => unit.resources.includes(source.url));
const sourceOwnerUnit = (category, source) => sourceUnits(category, source)[0] || null;
const sourceTarget = (page, source, category) => {
  const owner = sourceOwnerUnit(category, source);
  const targetPage = category.pageLayout === 'subtopics' && owner ? subtopicPage(category, owner) : `${category.dir}/index.html`;
  return `${link(page, targetPage)}#${anchor(source)}`;
};
const unitSources = unit => {
  const category = categoryById(unit.id.split('.')[0]);
  return unit.resources.map(url => {
    const ownSource = category.sources.find(source => source.url === url);
    return ownSource ? { ...ownSource, category } : sourceFor(url);
  });
};
const evidenceLink = (page, category, target) => {
  if (/^https?:/.test(target)) return target;
  const url = new URL(target, `https://wiki.local/${category.dir}/index.html`);
  return link(page, url.pathname.slice(1)) + url.search + url.hash;
};

assert.equal(categories.length, 10, 'The learning map must contain ten categories.');
assert.equal(new Set(categories.map(category => category.dir)).size, categories.length);
for (const category of categories) {
  assert.match(category.dir, /^\d{2}-[a-z-]+$/);
  assert(category.units.length > 0);
  const assigned = new Set(category.units.flatMap(unit => unit.resources));
  for (const url of category.sharedSourceUrls) {
    assert(sourceFor(url), `Unknown shared source: ${url}`);
    assigned.add(url);
  }
  assert(category.sources.every(source => assigned.has(source.url)), `Unassigned source in category ${category.id}`);
  for (const unit of category.units) {
    assert.match(unit.id, new RegExp(`^${category.id}\\.\\d+$`));
    assert(['not_started', 'in_progress', 'done'].includes(unit.status));
    assert(unit.status !== 'done' || unit.evidenceLink, 'Completed learning units require evidence.');
    assert(unit.resources.every(sourceFor), `Unknown source in ${unit.id}`);
    assert(unit.practiceNote && unit.exercise?.title && unit.exercise.goal, `Subtopic ${unit.id} requires practice and an exercise.`);
    assert(['planned', 'in_progress', 'done'].includes(unit.exercise.status));
    assert(unit.exercise.status !== 'done' || (unit.exercise.repository && unit.exercise.results), 'Completed exercises require code and results.');
  }
  assert.equal(new Set(category.units.map(unit => unit.id)).size, category.units.length);
  for (const source of category.sources) assert(new URL(source.url).protocol === 'https:');
}

function navigation(page, current) {
  const primary = [['index.html', '学习总览'], ['sources.html', '资料索引'], ['bad-cases.html', 'Bad cases']];
  const rootProjects = `<details class="nav-project-group nav-root-projects"><summary>跨方向 Projects</summary><div class="nav-project-children"><a class="nav-link ${current === 'projects/index.html' ? 'active' : ''}" href="${link(page, 'projects/index.html')}"${current === 'projects/index.html' ? ' aria-current="page"' : ''}>项目总览</a><a class="nav-link" href="${link(page, `${data.sharedProject.dir}/index.html`)}">${escape(projectNavLabel(data.sharedProject))}</a></div></details>`;
  return `<nav aria-label="仓库导航"><div class="nav-heading">工作区</div>${primary.map(([target, title]) => `<a class="nav-link ${current === target ? 'active' : ''}" href="${link(page, target)}" ${current === target ? 'aria-current="page"' : ''}>${title}</a>`).join('')}<div class="nav-heading nav-heading-topics">学习方向</div>${categories.map(category => {
    const title = escape(category.navTitle || category.title);
    const withinCategory = page.startsWith(`${category.dir}/`);
    const projectPage = `${category.dir}/projects/index.html`;
    const projectDetailPage = categoryProjectPage(category);
    const overviewPage = `${category.dir}/index.html`;
    const directOverview = category.id === '07';
    const categoryLabel = `<span class="nav-number">${category.id}</span><span>${title}</span>`;
    const categoryLink = `<a class="nav-link nav-category ${page === overviewPage ? 'active' : ''}" href="${link(page, overviewPage)}"${page === overviewPage ? ' aria-current="page"' : ''}>${categoryLabel}</a>`;
    const projectLink = `<a class="nav-link nav-project ${page === projectPage ? 'active' : ''}" href="${link(page, projectPage)}"${page === projectPage ? ' aria-current="page"' : ''}>Projects · 跨子方向</a>`;
    const unitLinks = category.units.map(unit => {
      const topicPage = category.pageLayout === 'subtopics' ? subtopicPage(category, unit) : `${category.dir}/index.html`;
      const projectTarget = exerciseTarget(page, category, unit);
      const isProjectCurrent = category.pageLayout === 'subtopics' && page === unitProjectPage(category, unit);
      const isCurrent = category.pageLayout === 'subtopics' && page === topicPage;
      const defaultOpen = category.id === '07' && unit.id === '07.1' && [subtopicPage(category, unit), unitProjectsPage(category, unit), unitProjectPage(category, unit)].includes(page);
      return `<details class="nav-unit-group" data-nav-unit="${unit.id}"${defaultOpen ? ' open' : ''}><summary title="展开或收起 ${unit.id} ${escape(unit.title)}"><a class="nav-link nav-unit ${isCurrent ? 'active' : ''}" href="${link(page, unitTarget(category, unit))}"${isCurrent ? ' aria-current="page"' : ''}><span class="nav-number">${unit.id}</span><span>${escape(unit.title)}</span></a></summary><div class="nav-project-children"><a class="nav-link nav-exercise${isProjectCurrent ? ' active' : ''}" data-nav-record href="${projectTarget}"${isProjectCurrent ? ' aria-current="page"' : ''}>${escape(projectDisplayTitle(unit.exercise))}</a></div></details>`;
    }).join('');
    return `<details class="nav-group" data-nav-category="${category.id}"${withinCategory ? ' open' : ''}><summary${directOverview ? ' class="nav-linked-summary"' : ''} title="展开或收起${title}">${directOverview ? categoryLink : categoryLabel}</summary><div class="nav-children">${directOverview ? '' : `<a class="nav-link ${page === overviewPage ? 'active' : ''}" href="${link(page, overviewPage)}"${page === overviewPage ? ' aria-current="page"' : ''}>方向总览</a>`}${unitLinks}<details class="nav-project-group"><summary class="nav-linked-summary" title="展开或收起跨子方向项目">${projectLink}</summary><div class="nav-project-children"><a class="nav-link nav-project-item${page === projectDetailPage ? ' active' : ''}" data-nav-record href="${link(page, projectDetailPage)}"${page === projectDetailPage ? ' aria-current="page"' : ''}>${escape(projectNavLabel(category.project))}</a></div></details></div></details>`;

  }).join('')}${rootProjects}</nav>`;
}

function render(page, title, current, body, toc = [], breadcrumb = '', pageClass = '') {
  const nav = navigation(page, current);
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="leo 的 LLM 与 Agent 工程架构学习 Wiki：理论、论文、实践、进度与复盘。">
  <title>${escape(title)} · leo 学习 Wiki</title>
  <link rel="icon" href="${link(page, 'assets/wiki-mark.svg')}" type="image/svg+xml">
  <link rel="stylesheet" href="${link(page, 'assets/wiki.css')}">
  <script src="${link(page, 'assets/wiki.js')}" defer></script>
</head>
<body class="${pageClass}">
  <a class="skip-link" href="#main">跳到正文</a>
  <aside class="sidebar"><a class="brand" href="${link(page, 'index.html')}"><img src="${link(page, 'assets/wiki-mark.svg')}" alt="" width="30" height="30"><span>leo<span class="brand-sub">LLM & Agent Wiki</span></span></a>${nav}<div class="sidebar-foot">理论 · 实践 · 证据<br>与 leo 一起持续学习</div></aside>
  <div class="workspace">
    <header class="topbar"><div class="breadcrumb"><a href="${link(page, 'index.html')}">学习仓库</a><span aria-hidden="true"> / </span><span>${escape(breadcrumb || title)}</span></div><span class="updated">更新于 ${escape(data.updatedAt)}</span></header>
    <details class="mobile-nav"><summary>学习目录</summary>${nav}</details>
    <div class="document-layout"><main id="main" tabindex="-1"><header class="page-header"><p class="eyebrow">${current.match(/^\d{2}(?:\.\d+)?$/) ? `${current.includes('.') ? '子课题' : '学习方向'} ${current}` : 'LEARNING WORKSPACE'}</p><h1>${escape(title)}</h1></header>${body}<footer class="page-footer"><span>leo · LLM & Agent 工程架构</span><a href="#main">返回顶部 ↑</a></footer></main></div>
  </div>
</body>
</html>
`;
  const target = path.join(root, page);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  generated.push(page);
}

function sourceLink(page, source, category, compact = false) {
  return `<a href="${sourceTarget(page, source, category)}" title="${escape(source.title)}">${escape(compact ? source.shortTitle || source.title : source.title)}</a>`;
}

function resourceList(page, sources, emptyText = '') {
  return sources.length ? `<ul class="resource-list">${sources.map(source => `<li>${sourceLink(page, source, source.category, true)}</li>`).join('')}</ul>` : (emptyText ? `<span class="resource-empty">${emptyText}</span>` : '');
}

function relatedUnits(page, source, category, withLabel = true) {
  const units = category.units.filter(unit => unit.resources.includes(source.url));
  if (!units.length) return '';
  const links = units.map(unit => `<a href="${link(page, unitTarget(category, unit))}">${unit.id} ${escape(unit.title)}</a>`).join(' · ');
  return `<p class="related-links">${withLabel ? '关联子课题：' : ''}${links}</p>`;
}

function experimentFields(project) {
  return `<dl class="record-fields"><dt>代码位置 / commit</dt><dd>${escape(project.repository || '尚未建立实现')}</dd><dt>运行环境</dt><dd>${escape(project.environment || '待实验开始后记录模型、依赖、配置与数据版本')}</dd><dt>结果与失败案例</dt><dd>${escape(project.results || '尚未运行，没有结果可报告')}</dd></dl>`;
}

function projectSummaryTable(page, project, target, scope) {
  const purpose = project.purpose || project.goal || '用于完成本层综合实践目标';
  const goal = project.purpose && project.goal && project.goal !== project.purpose ? `<small>${escape(project.goal)}</small>` : '';
  return `<div class="table-scroll"><table class="project-summary-table"><caption class="sr-only">${escape(projectDisplayTitle(project))}的项目摘要</caption><thead><tr><th scope="col">项目</th><th scope="col">用途简介</th><th scope="col">状态</th><th scope="col">详情</th></tr></thead><tbody><tr><th scope="row"><span class="project-number">${escape(project.id)}</span><a href="${link(page, target)}">${escape(projectName(project))}</a><small>${escape(scope)}</small></th><td>${escape(purpose)}${goal}</td><td>${badge(project.status)}</td><td><a href="${link(page, target)}">打开详情 →</a></td></tr></tbody></table></div>`;
}

function compactSubtopicTable(category, page) {
  return `<div data-filter-root>${filters('查找子方向', '名称或职责简介', { label: '学习状态', items: [['all', '全部状态'], ['not_started', '未开始'], ['in_progress', '学习中'], ['done', '已完成']] })}
<div class="table-scroll subtopic-scroll"><table class="subtopic-table"><caption class="sr-only">${escape(category.title)}的子方向摘要</caption><thead><tr><th scope="col">子方向</th><th scope="col">职责简介</th><th scope="col">学习状态</th><th scope="col">下一层页面</th></tr></thead><tbody>${category.units.map(unit => {
    const searchText = [unit.id, unit.title, unit.scope].join(' ');
    return `<tr id="${unitAnchor(unit)}" data-subtopic="${unit.id}" data-search-item data-search-text="${escape(searchText)}" data-filter-value="${unit.status}"><th scope="row"><span class="unit-number">${unit.id}</span><a class="subtopic-name" href="${link(page, unitTarget(category, unit))}">${escape(unit.title)}</a></th><td data-label="职责简介"><p>${escape(unit.scope)}</p></td><td data-label="学习状态">${badge(unit.status)}</td><td data-label="下一层页面"><a class="child-page-link" href="${link(page, unitTarget(category, unit))}">进入 ${unit.id} 详情 →</a><p class="muted">范围、资料、实践建议与练手项目</p></td></tr>`;
  }).join('')}</tbody></table></div><p class="empty" data-empty hidden>没有匹配的子方向。</p></div>`;
}
function subtopicTable(category, page) {
  return category.pageLayout === 'subtopics' ? compactSubtopicTable(category, page) : legacySubtopicTable(category, page);
}

function legacySubtopicTable(category, page) {
  return `<div data-filter-root>${filters('查找子方向', '主题、论文、开源项目或练习', { label: '学习状态', items: [['all', '全部状态'], ['not_started', '未开始'], ['in_progress', '学习中'], ['done', '已完成']] })}
<div class="table-scroll subtopic-scroll"><table class="subtopic-table"><caption class="sr-only">${escape(category.title)}的子方向、论文、开源项目、实践与练习</caption><colgroup><col class="col-subtopic"><col class="col-papers"><col class="col-code"><col class="col-practices"><col class="col-exercise"></colgroup><thead><tr><th scope="col">子方向 / 学习范围</th><th scope="col">Papers</th><th scope="col">开源项目</th><th scope="col">最佳实践 / 官方参考</th><th scope="col">练手项目</th></tr></thead><tbody>${category.units.map(unit => {
    const sources = unitSources(unit);
    const searchText = [unit.id, unit.title, unit.scope, unit.practiceNote, projectDisplayTitle(unit.exercise), unit.exercise.goal, ...sources.flatMap(source => [source.title, source.shortTitle || ''])].join(' ');
    const projectTarget = exerciseTarget(page, category, unit);
    return `<tr id="${unitAnchor(unit)}" data-subtopic="${unit.id}" data-search-item data-search-text="${escape(searchText)}" data-filter-value="${unit.status}"><th scope="row"><span class="unit-number">${unit.id}</span><a class="subtopic-name" href="${link(page, unitTarget(category, unit))}">${escape(unit.title)}</a>${badge(unit.status)}<p>${escape(unit.scope)}</p></th><td data-label="Papers">${resourceList(page, sources.filter(source => source.kind === 'paper'), '暂无直接对应论文')}</td><td data-label="开源项目">${resourceList(page, sources.filter(source => source.kind === 'github'), '待补充对应实现')}</td><td data-label="最佳实践 / 官方参考"><p class="practice-note">${escape(unit.practiceNote)}</p>${resourceList(page, sources.filter(source => source.kind === 'official'), '')}</td><td data-label="练手项目"${category.pageLayout !== 'subtopics' ? ` id="${exerciseAnchor(unit)}"` : ''}><a class="exercise-link" href="${projectTarget}">${escape(projectDisplayTitle(unit.exercise))}</a>${badge(unit.exercise.status)}<p>${escape(unit.exercise.goal)}</p><section class="acceptance-detail"><h4 class="detail-title">完成标准</h4><p>${escape(unit.evidence)}</p>${unit.evidenceLink ? `<a href="${escape(unit.evidenceLink)}">查看证据</a>` : ''}</section>${category.pageLayout !== 'subtopics' ? `<section class="record-detail"><h4 class="detail-title">实现与实验记录</h4>${experimentFields(unit.exercise)}${unit.exercise.experiments.length ? logEntries(page, unit.exercise.experiments) : '<p class="muted">暂无实验记录。</p>'}</section>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div><p class="empty" data-empty hidden>没有匹配的子方向。</p></div>`;
}

function filters(label, placeholder, options) {
  return `<div class="filters"><label class="search-field"><span>${label}</span><input type="search" data-search placeholder="${placeholder}" autocomplete="off"></label><label class="select-field"><span>${options.label}</span><select data-select>${options.items.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label></div><p class="result-count" data-result-count role="status" aria-live="polite"></p>`;
}

function logEntries(page, logs) {
  return `<div class="timeline">${logs.map(log => `<article class="log-entry"><div class="log-meta"><time datetime="${escape(log.date)}">${escape(log.date)}</time><span>${escape(log.kind || '实验')}</span></div><div><h3>${escape(log.title)}</h3><p>${escape(log.detail)}</p>${log.categoryIds?.length ? `<p class="related-links">${log.categoryIds.map(id => { const category = categoryById(id); return `<a href="${link(page, `${category.dir}/index.html`)}">${category.id} ${escape(category.title)}</a>`; }).join(' · ')}</p>` : ''}</div></article>`).join('')}</div>`;
}

function sourceRecordFields(source) {
  const fields = source.kind === 'github'
    ? [['version', '版本 / commit', '待调研时固定'], ['maintenance', '维护状态与适用性', '待检查'], ['modules', '关键模块与调用路径', '待读代码'], ['execution', '运行环境与结果', '尚未运行'], ['limitations', '局限与关联论文', '待记录']]
    : [['question', '核心问题', source.question], ['method', '方法与适用条件', '待阅读全文或文档后记录'], ['evidence', '数据、对照与结果', '待阅读核对，不预填结论'], ['conclusions', '结论与理解', '待记录，并区分作者结论与我们的判断'], ['limitations', '局限与未解问题', '待记录'], ['practice', '代码与实践证据', '尚无运行记录']];
  return fields.map(([key, label, fallback]) => `<dt>${escape(label)}</dt><dd>${escape(source.notes?.[key] || fallback)}</dd>`).join('');
}

function sourceCitation(source, compact = false) {
  if (!source.authors) return '';
  const authors = compact ? source.authors.slice(0, 3).join('; ') + (source.authors.length > 3 ? ' et al.' : '') : source.authors.join('; ');
  const isArxiv = new URL(source.url).hostname === 'arxiv.org';
  const dateLabel = source.dateLabel || (compact && isArxiv ? '首次提交' : '');
  const identifier = source.doi ? `DOI:${source.doi}` : isArxiv ? `arXiv:${source.id}` : source.publication;
  return `<p class="citation">${[authors, [dateLabel, source.date].filter(Boolean).join(' '), identifier].filter(Boolean).map(escape).join(' · ')}</p>`;
}

function sourceTableRow(page, source, category) {
  const localFile = source.localFile ? `<p class="related-links"><strong>本地文件：</strong><a href="${link(page, source.localFile)}">${escape(path.posix.basename(source.localFile))}</a></p>` : '';
  const notes = source.notes || {};
  const conclusions = notes.conclusions ? `<p><strong>结论摘要：</strong>${escape(notes.conclusions)}</p>` : '';
  const limitations = notes.limitations ? `<p><strong>适用边界：</strong>${escape(notes.limitations)}</p>` : '';
  return `<tr class="source-entry" id="${anchor(source)}"><td data-label="资料"><span id="source-map-${anchor(source)}" class="legacy-anchor"></span><div class="document-meta"><span class="source-kind">${sourceKinds[source.kind]}</span>${badge(source.status)}</div><strong class="source-title">${external(source.url, source.title)}</strong>${sourceCitation(source, true)}${localFile}</td><td data-label="关联子课题">${relatedUnits(page, source, category, false) || '<span class="muted">本页</span>'}</td><td data-label="本页关注"><p>${escape(source.question)}</p></td><td data-label="结论与边界">${conclusions || '<p class="muted">暂无结论摘要。</p>'}${limitations}</td><td data-label="核对信息"><p class="verification">${escape(source.verification)}${source.checkedAt ? ` · ${escape(source.checkedAt)}` : ''}</p></td></tr>`;
}

function sourceTable(page, sources, category) {
  return `<div class="table-scroll source-table-scroll"><table class="source-table"><caption class="sr-only">${escape(category.title)}资料</caption><thead><tr><th scope="col">资料</th><th scope="col">关联子课题</th><th scope="col">本页关注</th><th scope="col">结论与边界</th><th scope="col">核对信息</th></tr></thead><tbody>${sources.map(source => sourceTableRow(page, source, category)).join('')}</tbody></table></div>`;
}

function sourceGroups(page, sources, category, includeLegacyIds = false) {
  const groups = [['paper', 'papers', '论文'], ['github', 'implementations', '开源项目'], ['official', 'references', '官方参考']];
  return groups.map(([kind, id, title]) => {
    const groupSources = sources.filter(source => source.kind === kind);
    if (!groupSources.length) return includeLegacyIds ? `<span id="${id}" class="legacy-anchor"></span>` : '';
    const headingId = includeLegacyIds ? ` id="${id}"` : '';
    return `<h3${headingId} class="source-group-title">${title}</h3>${sourceTable(page, groupSources, category)}`;
  }).join('');
}

function architectureSourceNotes(project) {
  const architecture = project.architecture;
  return `<section class="eval-architecture-notes" id="architecture-sources"><h3>架构资料依据</h3><p>${escape(architecture.designBasis)}</p><p>${escape(architecture.evidenceNote)}</p><ul class="eval-sources">${architecture.sources.map(source => `<li id="architecture-source-${source.id}"><span class="source-kind">${escape(source.kind)}</span><h4>${external(source.url, source.title)}</h4><p class="citation">${escape([source.authors, source.date, source.version].filter(Boolean).join(' · '))}</p><p><strong>支持本架构：</strong>${escape(source.supports)}</p><p><strong>核对范围与局限：</strong>${escape(source.limitations)}</p>${source.citations ? `<p class="citation">OpenAlex 收录引用 ${source.citations.count.toLocaleString('en-US')} 次 · 查询于 ${escape(source.citations.checkedAt)} · ${external(source.citations.url, '统计条目')}。</p>` : ''}<p class="citation">核对于 ${escape(source.checkedAt)}${source.repository ? ` · ${external(source.repository, '原始实现')}` : ''}</p></li>`).join('')}</ul></section>`;
}

function evaluationArchitecture(page, category, project) {
  const architecture = project.architecture;
  if (!architecture) return '';
  const components = new Map(architecture.components.map(component => [component.id, component]));
  assert.equal(components.size, architecture.components.length, 'Architecture component IDs must be unique.');
  const sources = new Map(architecture.sources.map(source => [source.id, source]));
  const citations = section => (architecture.inlineCitations?.[section]?.length ? `<span class="eval-citations">${architecture.inlineCitations[section].map(id => {
    assert(sources.has(id), `Unknown architecture source: ${id}`);
    return `<a href="${architectureSourceLink(page, category, project, id)}">${escape(sources.get(id).shortTitle.split(' / ')[0])}</a>`;
  }).join(' · ')}</span>` : '');
  const componentLink = id => {
    const component = components.get(id);
    assert(component, `Unknown architecture component: ${id}`);
    return `<a id="eval-node-${id}" href="#component-${id}">${escape(component.title)}</a>`;
  };
  const runtimeNode = id => {
    const component = components.get(id);
    assert(component, `Unknown architecture runtime component: ${id}`);
    return `<a class="eval-node" href="#component-${id}"><strong>${escape(component.title)}</strong><span class="eval-node-summary">${escape(component.summary)}</span></a>`;
  };
  const runtimeSequence = architecture.runtime.sequence || ['simulator', 'agent', 'sandbox'];
  const runtimeEdges = architecture.runtime.edgeLabels || ['客户消息／回复', '工具调用／结果'];
  assert.equal(runtimeEdges.length, runtimeSequence.length - 1, 'Runtime edge labels must match the runtime sequence.');
  const runtimeMarkup = runtimeSequence.map((id, index) => `${runtimeNode(id)}${index < runtimeEdges.length ? `<div class="eval-edge"><span aria-hidden="true">⇄</span><small>${escape(runtimeEdges[index])}</small></div>` : ''}`).join('');
  const rows = (items, fields) => items.map(item => `<tr>${fields.map(([key, label], index) => index === 0 ? `<th scope="row">${escape(item[key])}</th>` : `<td data-label="${label}">${escape(item[key])}</td>`).join('')}</tr>`).join('');
  const table = (items, fields, caption) => `<table class="eval-spec-table eval-decision-table"><caption class="sr-only">${escape(caption)}</caption><thead><tr>${fields.map(([, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows(items, fields)}</tbody></table>`;
  return `${heading('architecture', escape(architecture.title) + ' · 架构 v' + escape(architecture.version))}
<section class="eval-architecture" lang="zh-CN" aria-label="客服 Agent 评估系统架构">
<div class="eval-intro"><p class="eval-summary">${escape(architecture.summary)}</p><p class="eval-design-status">${escape(architecture.statusNote)} · 更新于 ${escape(architecture.date)}</p></div>
<nav class="eval-section-links" aria-label="架构阅读顺序"><a href="#evaluation-map-caption">系统总览</a><a href="#evaluation-runtime">一次试验</a><a href="#evaluation-checks">如何判定</a><a href="#evaluation-metrics">如何比较</a><a href="#evaluation-example-title">退货示例</a><a href="#component-contracts">组件职责</a><a href="#architecture-sources">资料依据</a></nav>
<figure class="eval-overview" aria-labelledby="evaluation-map-caption"><figcaption id="evaluation-map-caption">${escape(architecture.flowCaption)}</figcaption>
<ol class="eval-flow">${architecture.flow.map((stage, index) => `<li><span class="eval-flow-number">${String(index + 1).padStart(2, '0')}</span><h3>${escape(stage.title)}</h3><p>${escape(stage.summary)}</p><div class="eval-flow-links">${stage.components.map(componentLink).join('')}</div></li>`).join('')}</ol>
<p class="eval-feedback">${escape(architecture.feedback)} <a href="#eval-node-scenarios">回到场景库 ↑</a></p></figure>
<dl class="eval-terms">${architecture.terms.map(term => `<div><dt>${escape(term.title)}</dt><dd>${escape(term.detail)}</dd></div>`).join('')}</dl>
<h3 class="eval-subheading" id="evaluation-runtime">一次试验：谁能看到什么</h3>
<p>${escape(architecture.runtime.summary)}</p>
<div class="eval-runtime-panel"><p class="eval-control"><a href="#component-runner">评估运行器</a> · ${escape(architecture.runtime.control)}</p>
<div class="eval-sequence eval-runtime${runtimeSequence.length > 3 ? ' eval-runtime-dual' : ''}">${runtimeMarkup}</div>
<p class="eval-control eval-evidence"><a href="#component-evidence">执行证据</a> · ${escape(architecture.runtime.evidence)}</p></div>
<div class="eval-routes" aria-label="信息访问边界">${architecture.routing.map(route => `<a href="#component-${route.target}"><strong>${escape(route.label)} → ${escape(components.get(route.target).title)}</strong><span>${escape(route.detail)}</span></a>`).join('')}</div>
<p class="eval-source-note">${escape(architecture.runtime.boundary)} ${citations('runtime')}</p>
<h3 class="eval-subheading" id="evaluation-checks">如何判定：有效、完成、合规、好用</h3>
<p>${escape(architecture.checkSummary)}</p>
${table(architecture.checks, [['title', '检查'], ['evidence', '依据什么'], ['decision', '如何处理']], '各项评估使用的证据与判定方式')}
<p class="eval-source-note">${escape(architecture.checkBoundary)} ${citations('checks')}</p>
<h3 class="eval-subheading" id="evaluation-metrics">如何比较：先固定标准，再比较版本</h3>
${table(architecture.metrics, [['title', '指标'], ['meaning', '怎样理解'], ['report', '必须同时报告']], '版本比较指标与适用范围')}
<p class="eval-source-note">${escape(architecture.metricBoundary)} ${citations('metrics')}</p>
<div class="eval-release"><h4>发布决策</h4>${list(architecture.release.rules)}<p>${escape(architecture.release.versionNote)} ${citations('release')}</p></div>
<section class="eval-example" aria-labelledby="evaluation-example-title"><h3 id="evaluation-example-title">${escape(architecture.example.title)}</h3><p>${escape(architecture.example.setup)}</p><p><strong>验收标准：</strong>${escape(architecture.example.expected)}</p>
${table(architecture.example.cases, [['title', '观察到的行为'], ['decision', '评估结论'], ['reason', '原因']], '同一退货任务中的不同评估结论')}
<p>${escape(architecture.example.boundary)}</p></section>
<h3 class="eval-subheading" id="component-contracts">组件职责</h3>
<p class="muted">总览中的每个组件都在这里说明输入、输出与关键约束；点击组件名称返回总览。</p>
<table class="eval-spec-table"><caption class="sr-only">各架构组件的输入、输出和关键约束</caption><thead><tr><th scope="col">组件</th><th scope="col">输入</th><th scope="col">输出</th><th scope="col">关键约束</th></tr></thead><tbody>${architecture.components.map(component => `<tr id="component-${component.id}"><th scope="row"><a href="#eval-node-${component.id}">${escape(component.title)} ↑</a></th><td data-label="输入">${escape(component.input)}</td><td data-label="输出">${escape(component.output)}</td><td data-label="关键约束">${escape(component.rule)}</td></tr>`).join('')}</tbody></table>
${architectureSourceNotes(project)}
<div class="eval-revisions"><h4>版本记录</h4>${list(architecture.revisions)}</div>
</section>`;
}

function renderUnitProjects(category, unit) {
  const listPage = unitProjectsPage(category, unit);
  const page = unitProjectPage(category, unit);
  const project = unit.exercise;
  const topic = subtopicPage(category, unit);
  render(listPage, `${unit.id} · Projects`, unit.id, `<p class="lead">${escape(unit.title)}的练手项目。这里仅展示下一层项目的用途和状态，具体实现、验收与实验记录进入项目详情。</p>
<p><a href="${link(listPage, topic)}">← ${unit.id} ${escape(unit.title)}</a></p>
${heading('projects', '项目列表')}${projectSummaryTable(listPage, project, page, '子方向练习')}
`, [['projects', '项目列表']], `${category.id} / ${unit.id} / Projects`);
  render(page, projectHeading(project), project.id, `<p class="lead">${escape(project.goal)}</p>
<div class="document-meta">${badge(project.status)}<a href="${link(page, topic)}">${unit.id} ${escape(unit.title)}</a><a href="${link(page, listPage)}">Projects 列表</a></div>
${heading('goal', '项目目标')}<p>${escape(project.goal)}</p>
${heading('acceptance', '完成标准')}${project.acceptance?.length ? list(project.acceptance) : `<p>${escape(unit.evidence)}</p>`}${unit.evidenceLink ? `<p><a href="${escape(evidenceLink(page, category, unit.evidenceLink))}">关联学习完成证据</a></p>` : ''}
${heading('practice', '实践建议')}<p>${escape(unit.practiceNote)}</p><p class="muted">这是待验证的实践计划；项目完成以实际实现和验收结果为准。</p>
${evaluationArchitecture(page, category, project)}
${project.steps?.length ? `${heading('plan', '实施计划')}<ol class="steps">${project.steps.map(step => `<li>${escape(step)}</li>`).join('')}</ol>` : ''}
${heading('implementation', '实现与结果')}${experimentFields(project)}
${heading('experiments', '实验记录')}${project.experiments.length ? logEntries(page, project.experiments) : '<p class="empty">暂无实验记录。</p>'}
<p id="references"${project.architecture ? ' class="legacy-project-link"' : ''}><a href="${project.architecture ? architectureSourceLink(page, category, project) : `${link(page, topic)}#source-notes`}">${project.architecture ? '架构资料依据' : `${unit.id} 相关理论与资料`} →</a></p>
<p><a href="${link(page, topic)}">← 返回 ${unit.id} ${escape(unit.title)}</a> · <a href="${link(page, listPage)}">Projects 列表</a></p>
`, [['goal', '项目目标'], ['acceptance', '完成标准'], ['practice', '实践建议'], ...(project.architecture ? [['architecture', '项目架构']] : []), ...(project.steps?.length ? [['plan', '实施计划']] : []), ['implementation', '实现与结果'], ['experiments', '实验记录'], ['references', '相关资料']], `${category.id} / ${unit.id} / ${project.id}`);
}

function renderSubtopic(category, unit, index) {
  const page = subtopicPage(category, unit);
  const sources = unitSources(unit);
  const exercise = unit.exercise;
  const adjacent = (other, label) => other ? `<a href="${link(page, subtopicPage(category, other))}"><span>${label}</span>${other.id} ${escape(other.title)}</a>` : '<span></span>';
  const ownedSources = sources.filter(source => sourceOwnerUnit(category, source)?.id === unit.id);
  const groupedSources = sourceGroups(page, ownedSources, category, true);
  renderUnitProjects(category, unit);
  render(page, unit.title, unit.id, `<p class="lead">${escape(unit.scope)}</p>
<div class="document-meta">${badge(unit.status)}<a href="${link(page, `${category.dir}/index.html`)}">${category.id} 方向总览</a></div>
<div class="section-links"><a href="#overview">课题信息</a><a href="#sources">资料</a><a href="#exercise">练手项目</a></div>
${heading('overview', '课题信息')}<div class="table-scroll"><table class="unit-info-table"><caption class="sr-only">${escape(unit.title)}的学习信息</caption><tbody><tr id="completion"><th scope="row">完成标准</th><td>${escape(unit.evidence)}${unit.evidenceLink ? `<br><a href="${escape(evidenceLink(page, category, unit.evidenceLink))}">查看学习完成证据 →</a>` : ''}</td></tr><tr id="practice"><th scope="row">实践重点</th><td>${escape(unit.practiceNote)}<small>实践建议需通过实验验证；资料收录与练习计划不计为学习完成。</small></td></tr><tr id="exercise"><th scope="row">下一层项目</th><td><a href="${link(page, unitProjectPage(category, unit))}">${escape(projectDisplayTitle(exercise))}</a><small>${escape(exercise.goal)} · ${statuses[exercise.status]}</small></td></tr></tbody></table></div>
${heading('sources', '资料')}${groupedSources}<span id="source-notes" class="legacy-anchor"></span>${ownedSources.length ? '' : '<p class="muted">本页资料已在相关子方向页面记录。</p>'}
<p class="related-links"><a href="${link(page, unitProjectsPage(category, unit))}">查看 ${unit.id} 的 Projects 列表 →</a></p>
${heading('experiments', '项目实验记录')}<p><a href="${link(page, unitProjectPage(category, unit))}#experiments">在项目独立页面查看实现、结果与实验记录 →</a></p>
<p class="related-links"><a href="${link(page, categoryProjectPage(category))}">${escape(projectDisplayTitle(category.project))}</a>${category.project.architecture ? ` · <a href="${link(page, categoryProjectPage(category))}#architecture">客服 Agent 评估架构 v${escape(category.project.architecture.version)} →</a>` : ''} · <a href="${link(page, `${data.sharedProject.dir}/index.html`)}">${escape(projectDisplayTitle(data.sharedProject))}</a></p>
<nav class="subtopic-pagination" aria-label="相邻子课题">${adjacent(category.units[index - 1], '上一课题')}${adjacent(category.units[index + 1], '下一课题')}</nav>
`, [['overview', '课题信息'], ['sources', '资料'], ['experiments', '实验记录']], `${category.id} / ${unit.id} ${unit.title}`);
}

const generated = [];
const overview = 'index.html';
render(overview, data.title, overview, `
<p class="lead">以原始论文、权威文档和开源项目为依据，连接理论、实践与持续复盘。</p>
<div class="summary-strip"><div><strong>${categories.length}</strong><span>学习方向</span></div><div><strong>${completed}<small> / ${totalUnits}</small></strong><span>已完成单元</span></div><div><strong>${completedProjects}<small> / ${categories.length + 1}</small></strong><span>已完成项目</span></div><div><strong>${uniqueSources.length}</strong><span>资料入口</span></div></div>
${heading('map', '学习地图')}
<div data-filter-root>${filters('查找方向', '名称、主题、论文或项目', { label: '学习状态', items: [['all', '全部状态'], ['not_started', '未开始'], ['in_progress', '学习中'], ['done', '已完成']] })}
<div class="table-scroll"><table class="topic-table"><thead><tr><th scope="col">方向与学习内容</th><th scope="col">状态</th><th scope="col">单元进度</th></tr></thead><tbody>${categories.map(category => `<tr data-search-item data-search-text="${escape(`${category.id} ${category.title} ${category.english} ${category.summary} ${category.keywords} ${category.sources.map(source => source.title).join(' ')} ${category.units.map(unit => unit.title).join(' ')}`)}" data-filter-value="${categoryStatus(category)}"><td><a class="topic-title" href="${category.dir}/index.html"><span class="topic-number">${category.id}</span>${escape(category.title)}</a><p>${escape(category.summary)}</p></td><td>${badge(categoryStatus(category))}</td><td>${progress(category.units.filter(unit => unit.status === 'done').length, category.units.length)}</td></tr>`).join('')}</tbody></table></div><p class="empty" data-empty hidden>没有匹配的学习方向。</p></div>
${heading('architecture', '架构视角')}
<figure class="architecture"><img src="assets/agent-loop.svg" width="900" height="156" alt="用户任务进入编排和状态层，模型使用上下文做决策，工具执行后返回环境反馈；评估、安全和运行治理贯穿全过程。"><figcaption>把模型放进可验证的控制循环，再逐步加入上下文、权限、质量和运行保障。</figcaption></figure>
${heading('approach', '学习与实践')}${list(data.principles)}<p>当前完成了目录与计划建档，全文阅读和项目实验均未开始。进度仅统计有证据的学习单元。</p>
${heading('evaluation-loop', '第七类：贯穿上线前后的评估')}
<p>离线评测、线上评估、执行可观测性、效果趋势和 bad-case 回归共同构成持续改进。第十类关注运行可靠性；两者通过同一次执行记录关联。</p>
<p class="flow-line">生产执行 → 质量评估 → 失败归因 → 复现与修复 → 离线回归 → 发布后验证</p>
<p><a href="07-evaluation-and-observability/index.html">查看第七类学习计划 →</a></p>
`, [['map', '学习地图'], ['architecture', '架构视角'], ['approach', '学习与实践'], ['evaluation-loop', '评估闭环']], '总览');

for (const category of categories) {
  if (category.pageLayout === 'subtopics') category.units.forEach((unit, index) => renderSubtopic(category, unit, index));
  const page = `${category.dir}/index.html`;
  const done = category.units.filter(unit => unit.status === 'done').length;
  render(page, category.title, category.id, `<p class="lead">${escape(category.summary)}</p>
<div class="document-meta">${badge(categoryStatus(category))}<span>${escape(category.english)}</span>${progress(done, category.units.length)}</div>
<div class="section-links"><a href="#curriculum">子方向</a><a href="#practice">跨子方向综合练习</a></div>
<section class="scope-note" id="scope"><h2 class="detail-title">学习边界与前置基础</h2>
${category.id === '07' ? `<p>本方向覆盖 Agent 的整个生命周期。线上评估针对真实生产任务，可以异步执行；离线评测也可在上线后持续运行。评分趋势用于发现问题，A/B 试验用于比较版本的因果效果，二者不能混为一谈。</p><p>任务是否真正完成、答案是否可靠、动作是否正确归入本方向；可用性、并发、重试和恢复能力主要在<a href="../10-production-and-reliability/index.html">第十类</a>学习。两类指标可以共享执行记录。</p>` : category.id === '10' ? `<p>本方向关注服务是否稳定可用、故障后能否恢复以及资源是否可控。线上答案质量、真实任务成功率与 bad-case 分析主要在<a href="../07-evaluation-and-observability/index.html">第七类</a>学习。</p>` : `<p>从原理、资料、实现和实验四个角度学习，以可检查的产出验证理解。</p>`}
<p class="prerequisites">${category.prerequisites.length ? `建议先建立基础：${category.prerequisites.map(id => { const related = categoryById(id); return `<a href="${link(page, `${related.dir}/index.html`)}">${id} ${escape(related.title)}</a>`; }).join(' · ')}。这里表示基础依赖，不要求先完成整个分类。` : '起点方向：先掌握基本编程、API 调用和测试，再进入最小 Agent 实验。'}</p></section>
${heading('curriculum', '子方向')}
${subtopicTable(category, page)}
<p class="muted">实践要点为工程建议，需结合原始资料与实验核验。资料收录不计为已读；练习计划不计为已完成。</p>
${category.sharedSourceUrls.length ? `${heading('references', '全方向参考')}${resourceList(page, category.sharedSourceUrls.map(sourceFor))}` : ''}
${heading('practice', '跨子方向综合项目')}
${projectSummaryTable(page, category.project, categoryProjectPage(category), '本方向下一层项目')}
${category.project.architecture ? `<p><a href="${link(page, categoryProjectPage(category))}#architecture">客服 Agent 评估系统架构 v${escape(category.project.architecture.version)} →</a></p>` : ''}
<p>综合实践：<a href="${link(page, `${data.sharedProject.dir}/index.html`)}">${escape(projectDisplayTitle(data.sharedProject))}</a>。可以逐步把本方向能力接入同一实验载体。</p>
${category.pageLayout === 'subtopics' ? '' : `${heading('source-notes', '资料说明')}${sourceGroups(page, category.sources, category)}`}
`, [], '', 'category-page');

  const projectIndex = `${category.dir}/projects/index.html`;
  const projectPage = categoryProjectPage(category);
  const project = category.project;
  const architecture = evaluationArchitecture(projectPage, category, project);
  const projectSections = [['goal', '项目目标'], ['plan', '实施计划'], ['acceptance', '验收标准'], ['evidence', '实验记录'], ['references', '理论与实现依据'], ['exercises', '相关子方向项目']];
  const legacySections = [...projectSections, ...[...architecture.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], '项目架构'])];
  const legacyLink = (id, target, title) => `<p class="legacy-project-link" id="${id}"><a href="${target}">查看${escape(title)} →</a></p>`;
  render(projectIndex, `${category.title} · 跨子方向项目`, category.id, `<p class="lead">跨越本方向多个子方向的综合项目。这里仅展示下一层项目的用途和状态，详细方案、实现与实验记录进入项目详情。</p>
<div class="document-meta"><span>1 个跨子方向项目</span><span>${project.status === 'done' ? 1 : 0} 个已完成</span><a href="../index.html">← ${category.id} ${escape(category.title)}</a></div>
${heading('projects', '项目列表')}${projectSummaryTable(projectIndex, project, projectPage, '跨子方向综合项目')}
${legacySections.map(([id, title]) => legacyLink(id, `${link(projectIndex, projectPage)}#${id}`, `${project.id} · ${title}`)).join('')}
${category.units.map(unit => legacyLink(exerciseAnchor(unit), exerciseTarget(projectIndex, category, unit), projectDisplayTitle(unit.exercise))).join('')}
`, [], `${category.id} / 跨子方向项目`);

  render(projectPage, projectHeading(project), project.id, `<p class="lead">${escape(project.goal)}</p>
<div class="document-meta">${badge(project.status)}<a href="index.html">← Projects · 跨子方向</a><a href="../index.html">${category.id} ${escape(category.title)}</a></div>
${project.architecture ? `<p class="eval-project-entry"><a href="#architecture">客服 Agent 评估系统 · 架构 v${escape(project.architecture.version)} ↓</a><span>架构方案</span></p>` : ''}
${heading('goal', '项目目标')}<p data-project-scope="cross-subtopic">${escape(project.goal)}</p>
${architecture}
${heading('plan', '实施计划')}<ol class="steps">${project.steps.map(step => `<li>${escape(step)}</li>`).join('')}</ol>
${heading('acceptance', '验收标准')}${list(project.acceptance)}
${heading('evidence', '实验记录')}${experimentFields(project)}
${project.experiments.length ? logEntries(projectPage, project.experiments) : '<p class="empty">暂无实验记录。</p>'}
<p id="references"${project.architecture ? ' class="legacy-project-link"' : ''}><a href="${project.architecture ? architectureSourceLink(projectPage, category, project) : `${link(projectPage, `${category.dir}/index.html`)}#source-notes`}">${project.architecture ? '架构资料依据' : '本方向资料说明'} →</a></p>
<section class="project-shortcuts" id="exercises"><h2>子方向项目入口</h2><p>专项练习及其实验记录保存在各自的子方向中，这里仅保留入口。</p><ul class="plain-list">${category.units.map(unit => `<li id="${exerciseAnchor(unit)}"><a href="${exerciseTarget(projectPage, category, unit)}">${unit.id} ${escape(unit.title)} · ${escape(projectName(unit.exercise))}</a></li>`).join('')}</ul></section>
<p><a href="${link(projectPage, `${data.sharedProject.dir}/index.html`)}">关联综合实验</a></p>
<p><a href="index.html">← 返回 Projects · 跨子方向</a></p>
`, [['goal', '项目目标'], ...(project.architecture ? [['architecture', '客服评估架构']] : []), ['plan', '实施计划'], ['acceptance', '验收标准'], ['evidence', '实验记录'], ...(!project.architecture ? [['references', '资料记录']] : []), ['exercises', '子方向项目入口']], `${category.id} / 跨子方向项目 / ${project.id}`);
}

render('projects/index.html', '跨方向 Projects', 'projects/index.html', `<p class="lead">这里只收录跨越多个学习方向的项目。这里仅展示下一层项目的用途和状态，详细记录进入项目详情。</p>
${heading('shared', '跨方向项目')}${projectSummaryTable('projects/index.html', data.sharedProject, `${data.sharedProject.dir}/index.html`, '跨方向综合项目')}
<section id="category-projects"><h2>项目归属</h2><p>单一子方向的项目在该子方向内维护；跨子方向但仍属于同一学习方向的项目，在该方向的 Projects 中维护。各方向入口见<a href="../index.html#map">学习地图</a>。</p></section>
${heading('records', '实践记录')}<p>本目录已完成的跨方向项目：${data.sharedProject.status === 'done' ? 1 : 0} / 1。实验是否运行、结果是否通过验收，以项目实际记录为准。</p>
`, [['shared', '跨方向项目'], ['category-projects', '项目归属'], ['records', '实践记录']]);

const sharedPage = `${data.sharedProject.dir}/index.html`;
render(sharedPage, projectHeading(data.sharedProject), 'projects/index.html', `<p class="lead">${escape(data.sharedProject.goal)}</p><div class="document-meta">${badge(data.sharedProject.status)}<span>跨方向综合项目</span></div><p><a href="../index.html">← 综合实践</a></p>
${heading('milestones', '阶段计划')}<div class="table-scroll"><table><thead><tr><th scope="col">阶段</th><th scope="col">关联方向与产出</th><th scope="col">状态</th></tr></thead><tbody>${data.sharedProject.milestones.map((milestone, index) => `<tr><td><strong>${index + 1}. ${escape(milestone.title)}</strong></td><td><p>${escape(milestone.outcome)}</p><p class="related-links">${milestone.categoryIds.map(id => { const category = categoryById(id); return `<a href="${link(sharedPage, `${category.dir}/index.html`)}">${id} ${escape(category.title)}</a>`; }).join(' · ')}</p></td><td>${badge(milestone.status)}</td></tr>`).join('')}</tbody></table></div>
${heading('acceptance', '完成标准')}${list(data.sharedProject.acceptance)}
${heading('experiments', '运行与复盘')}<dl class="record-fields"><dt>实现与环境</dt><dd>尚未建立。后续按当前阶段选择模型、语言、依赖与数据。</dd><dt>实验结果</dt><dd>尚未运行。不能据此判断任何架构的实际效果。</dd><dt>下一步</dt><dd>从第 01、02 类的最小 Agent 循环和工具契约开始。</dd></dl>
`, [['milestones', '阶段计划'], ['acceptance', '完成标准'], ['experiments', '运行与复盘']]);

render('sources.html', '资料索引', 'sources.html', `<p class="lead">按方向组织的原始论文、官方材料和开源实现。</p><p class="muted">${uniqueSources.length} 个不同来源，${allSources.length} 条分类关联。收录与核对不等于完成阅读；版本和适用范围在具体学习时确认。</p>
<div data-filter-root>${filters('查找资料', '标题、阅读问题或所属方向', { label: '资料类型', items: [['all', '全部类型'], ['paper', '论文'], ['official', '官方资料'], ['github', 'GitHub 项目']] })}
<div class="table-scroll"><table class="sources-table"><thead><tr><th scope="col">资料与阅读问题</th><th scope="col">方向</th><th scope="col">类型</th></tr></thead><tbody>${allSources.map(source => `<tr data-search-item data-search-text="${escape(`${source.title} ${source.question} ${source.category.title} ${source.id || ''}`)}" data-filter-value="${source.kind}"><td>${sourceLink('sources.html', source, source.category)}<p>${escape(source.question)}</p></td><td><a href="${source.category.dir}/index.html">${source.category.id}</a></td><td><span class="source-kind">${sourceKinds[source.kind]}</span></td></tr>`).join('')}</tbody></table></div><p class="empty" data-empty hidden>没有匹配的资料。</p></div>
`);

render('bad-cases.html', 'Bad cases', 'bad-cases.html', `<p class="lead">从错误结果回到执行证据，把可复现的失败变成回归测试。</p>
${heading('cases', '案例记录')}${data.badCases?.length ? data.badCases.map(item => `<article class="decision" id="${escape(item.id)}"><p class="log-meta">${escape(item.id)} · ${escape(item.date)} · ${escape(item.origin)}</p><h3>${escape(item.title)}</h3><dl class="record-fields">${[['expected', '预期行为'], ['actual', '实际行为'], ['trace', '执行与版本证据'], ['reproduction', '复现条件'], ['cause', '归因与复核'], ['fix', '修复与回归'], ['followup', '发布后验证']].map(([key, label]) => `<dt>${label}</dt><dd>${escape(item[key] || '待记录')}</dd>`).join('')}</dl></article>`).join('') : '<p class="empty">尚无已记录案例。模拟案例与真实生产案例将分开标明，避免把测试数据当作线上效果。</p>'}
${heading('loop', '处理闭环')}<p class="flow-line">收集 → 人工复核 → 去重与分类 → 归因 → 复现 → 修复 → 回归 → 上线验证</p>
${heading('taxonomy', '起始分类')}${list(['检索与上下文：未找到证据、引用错误、信息过时或上下文遗漏。','规划与工具：选错工具、参数错误、漏执行或重复动作。','任务结果：工具返回成功，但用户目标未达成。','安全与权限：遵循外部恶意指令、越权动作或敏感信息暴露。','运行故障：超时、资源不足、恢复失败；关联第十类。','评估偏差：模型裁判误判、用户反馈缺失或样本选择偏差。'])}
<p><a href="07-evaluation-and-observability/index.html">第七类学习计划</a></p>
`, [['cases', '案例记录'], ['loop', '处理闭环'], ['taxonomy', '起始分类']]);

const learningLogMarkdown = [
  '# 学习记录',
  '',
  '学习记录保存在本 Markdown 文件和 `wiki/content.json` 中，不在 HTML 页面展示。',
  '',
  ...data.logs.flatMap(log => [
    `## ${log.date} · ${log.kind || '记录'} · ${log.title}`,
    '',
    log.detail,
    '',
    log.categoryIds?.length ? `关联方向：${log.categoryIds.map(id => { const category = categoryById(id); return `${id} ${category?.title || ''}`; }).join('；')}` : '关联方向：仓库范围',
    log.unitIds?.length ? `关联子方向：${log.unitIds.join('、')}` : '',
    log.projectIds?.length ? `关联项目：${log.projectIds.join('、')}` : '',
    ''
  ])
].filter(Boolean).join('\n');
fs.writeFileSync(path.join(root, 'wiki/learning-log.md'), `${learningLogMarkdown}\n`);

console.log(`Generated ${generated.length} HTML pages; ${categories.length} categories, ${totalUnits} learning units, ${uniqueSources.length} unique sources.`);
