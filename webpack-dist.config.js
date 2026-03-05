const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const findChrome = require('chrome-finder');
const TerserPlugin = require('terser-webpack-plugin');
const DefinePlugin = require('webpack/lib/DefinePlugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const EndWebpackPlugin = require('end-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ghpages = require('gh-pages');

function publishGhPages() {
  return new Promise((resolve, reject) => {
    ghpages.publish(outputPath, { dotfiles: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    })
  });
}

const outputPath = path.resolve(__dirname, '.public');
module.exports = {
  output: {
    path: outputPath,
    publicPath: '',
    filename: '[name]_[chunkhash:8].js',
  },
  resolve: {
    // 加快搜索速度
    modules: [path.resolve(__dirname, 'node_modules')],
    // es tree-shaking
    mainFields: ['jsnext:main', 'browser', 'main'],
    fallback: {
      events: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        // 提取出css
        use: [
          MiniCssExtractPlugin.loader,
          // 压缩css
          'css-loader',
          'postcss-loader',
          'sass-loader'
        ],
        include: path.resolve(__dirname, 'src')
      },
      {
        test: /\.css$/,
        // 提取出css
        use: [
          MiniCssExtractPlugin.loader,
          // 压缩css
          'css-loader',
          'postcss-loader',
        ],
      },
      {
        test: /\.(gif|png|jpe?g|eot|woff|ttf|svg|pdf)$/,
        type: 'asset/inline',
      },
    ]
  },
  entry: {
    main: './src/main.js',
  },
  performance: {
    // 简历静态站，放宽单文件限制为 1 MiB，超出时仅警示不报错
    hints: 'warning',
    maxAssetSize: 1024 * 1024,
    maxEntrypointSize: 1024 * 1024,
  },
  optimization: {
    minimize: true,
    // 自动拆分 node_modules 中的大型三方库，避免主 chunk 过大
    splitChunks: {
      chunks: 'all',
      minSize: 30000,
      cacheGroups: {
        // html2canvas 单独拆包（体积最大）
        html2canvas: {
          test: /[\\/]node_modules[\\/]html2canvas[\\/]/,
          name: 'vendor.html2canvas',
          chunks: 'all',
          priority: 20,
        },
        // jspdf 单独拆包
        jspdf: {
          test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable)[\\/]/,
          name: 'vendor.jspdf',
          chunks: 'all',
          priority: 20,
        },
        // 其余 node_modules 合并为一个 vendors chunk
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor.common',
          chunks: 'all',
          priority: 10,
        },
      },
    },
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          // 最紧凑的输出
          format: { beautify: false, comments: false },
          compress: {
            // 在Terser删除没有用到的代码时不输出警告
            warnings: false,
            // 删除所有的 `console` 语句，可以兼容ie浏览器
            drop_console: true,
            // 内嵌定义了但是只用到一次的变量
            collapse_vars: true,
            // 提取出出现多次但是没有定义成变量去引用的静态值
            reduce_vars: true,
          }
        },
        extractComments: false,
      }),
    ],
  },
  plugins: [
    new DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify('production')
      }
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
    new MiniCssExtractPlugin({
      filename: '[name]_[contenthash:8].css',
    }),
    new EndWebpackPlugin(async () => {
      // 自定义域名
      fs.writeFileSync(path.resolve(outputPath, 'CNAME'), 'yaojusheng.github.io');
  
      // 生成文档格式的 PDF（非 Web UI 格式）
      const chromePath = findChrome();
      
      // 读取构建后的 index.html 并生成文档格式的打印版
      const indexHtml = fs.readFileSync(path.resolve(outputPath, 'index.html'), 'utf-8');
      const printHtml = generatePrintHtml(indexHtml);
      const printHtmlPath = path.resolve(outputPath, '_print.html');
      fs.writeFileSync(printHtmlPath, printHtml);
      
      // 使用 Chrome 打印文档格式的页面
      spawnSync(chromePath, [
        '--headless',
        '--disable-gpu',
        '--print-to-pdf-no-header',
        '--no-pdf-header-footer',
        `--print-to-pdf=${path.resolve(outputPath, 'resume.pdf')}`,
        `file://${printHtmlPath}`
        // 'https://yaojusheng.github.io/resume/' // 这里注意改成你的在线简历的网站
      ]);
      
      // 删除临时打印文件
      fs.unlinkSync(printHtmlPath);

      // 发布到 ghpages
      await publishGhPages();
    }),
  ]
};

/**
 * 从 Web UI 格式的 index.html 提取内容，生成文档格式的打印 HTML
 */
function generatePrintHtml(indexHtml) {
  // 简单的内容提取（基于 HTML 结构）
  const extract = (regex, html = indexHtml) => {
    const match = html.match(regex);
    return match ? match[1].trim() : '';
  };
  
  const extractAll = (regex, html = indexHtml) => {
    const results = [];
    let match;
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    while ((match = re.exec(html)) !== null) {
      results.push(match[1].trim());
    }
    return results;
  };

  // 提取基本信息
  const name = extract(/<div class="name">\s*<h1[^>]*>(?:<[^>]+>)?([^<]+)/);
  const job = extract(/<div class="job">\s*<h2[^>]*>([^<]+)/);
  
  // 提取个人信息列表
  const infoSection = extract(/<section class="info">([\s\S]*?)<\/section>/);
  const infoItems = extractAll(/<li>([^<]+)<\/li>/s, infoSection);
  
  // 提取联系方式
  const contactSection = extract(/<section class="contact">([\s\S]*?)<\/section>/);
  const contactLinks = [];
  const contactRegex = /<li>\s*<a[^>]*href="([^"]*)"[^>]*>\s*(?:<img[^>]*>)?\s*<span class="contact-link">([^<]+)<\/span>/g;
  let contactMatch;
  while ((contactMatch = contactRegex.exec(contactSection)) !== null) {
    contactLinks.push({ href: contactMatch[1], text: contactMatch[2].trim() });
  }
  
  // 提取技术栈
  const skillsSection = extract(/<section class="skills">([\s\S]*?)<\/section>/);
  const skillsItems = extractAll(/<li>([^<]+)<\/li>/s, skillsSection);
  
  // 提取自我评价
  const selfSection = extract(/<section class="self-assess">([\s\S]*?)<\/section>/);
  const selfItems = extractAll(/<li>([^<]+)<\/li>/s, selfSection);
  
  // 提取个人经历
  const practiceSection = extract(/<section class="practice">([\s\S]*?)<\/section>/);
  const experiences = [];
  const expRegex = /<div class="item">\s*<header class="item-hd">\s*<h3 class="item-name">([^<]+)<\/h3>\s*<span class="item-time">([^<]+)<\/span>\s*<a[^>]*>([^<]+)<\/a>\s*<\/header>\s*<div class="item-bd">\s*<p class="item-des">([^<]*(?:<a[^>]*>[^<]*<\/a>[^<]*)?)<\/p>\s*<ul class="section-content">([\s\S]*?)<\/ul>/g;
  let expMatch;
  while ((expMatch = expRegex.exec(practiceSection)) !== null) {
    const items = extractAll(/<li>([^<]+(?:<a[^>]*>[^<]*<\/a>[^<]*)?)<\/li>/s, expMatch[5]);
    experiences.push({
      company: expMatch[1].trim(),
      time: expMatch[2].trim(),
      type: expMatch[3].trim(),
      desc: expMatch[4].replace(/<[^>]+>/g, '').trim(),
      items: items
    });
  }
  
  // 提取项目经验（左侧）
  const projectLeftSection = extract(/<section class="project">\s*(?:<!--[^>]*-->\s*)?<header class="section-hd">\s*<span class="section-title-l"><\/span>\s*<h2 class="section-title">项目经验<\/h2>([\s\S]*?)<\/section>/);
  const projectsLeft = extractProjects(projectLeftSection || extract(/<div class="content-left">[\s\S]*?<section class="project">([\s\S]*?)<\/section>/));
  
  // 提取项目经验（右侧，继续项目）
  const contentRight = extract(/<div class="content-right">([\s\S]*?)<\/div>\s*<\/div>\s*<\/main>/);
  const projectRightSection = extract(/<section class="project">\s*<div class="section-bd">([\s\S]*?)<\/div>\s*<\/section>/, contentRight);
  const projectsRight = extractProjects(projectRightSection);
  
  // 提取开源项目
  const openSourceSection = extract(/<section class="project">\s*<header class="section-hd">\s*<span class="section-title-l"><\/span>\s*<h2 class="section-title">开源项目<\/h2>([\s\S]*?)<\/section>/);
  const openSourceProjects = extractOpenSourceProjects(openSourceSection);
  
  // 提取技能
  const skillSection = extract(/<section class="skill">([\s\S]*?)<\/section>/);
  const skills = extractSkills(skillSection);
  
  // 提取开发工具
  const toolSection = extract(/<section class="dev-tool">([\s\S]*?)<\/section>/);
  const tools = extractAll(/<li>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/li>/s, toolSection);
  
  // 生成文档格式 HTML
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title lang="en">Resume</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 40px 50px;
    }
    h1 { font-size: 24pt; margin-bottom: 5px; text-align: center; }
    h2.subtitle { font-size: 12pt; color: #666; text-align: center; margin-bottom: 20px; font-weight: normal; }
    h2.section-title {
      font-size: 14pt;
      color: #333;
      border-bottom: 2px solid #333;
      padding-bottom: 5px;
      margin: 20px 0 12px 0;
    }
    h3.category { font-size: 12pt; color: #0066cc; margin: 12px 0 6px 0; }
    h4.item-title { font-size: 11pt; margin: 10px 0 4px 0; }
    .meta { font-size: 10pt; color: #666; margin-bottom: 4px; }
    p { margin: 6px 0; }
    ul { margin: 6px 0 6px 20px; }
    li { margin: 3px 0; }
    .info-grid { display: flex; flex-wrap: wrap; gap: 10px 30px; margin-bottom: 15px; }
    .info-item { font-size: 10pt; }
    .contact-grid { display: flex; flex-wrap: wrap; gap: 5px 25px; margin-bottom: 15px; }
    .contact-item { font-size: 10pt; }
    .contact-item a { color: #0066cc; text-decoration: none; }
    .skill-tag { display: inline-block; background: #f0f0f0; padding: 2px 8px; margin: 2px; border-radius: 3px; font-size: 10pt; }
    .project-item { margin-bottom: 12px; padding-left: 10px; }
    .project-item dt { font-weight: bold; margin-bottom: 3px; }
    .project-item dd { margin-left: 15px; font-size: 10pt; color: #555; margin-bottom: 2px; }
    .exp-item { margin-bottom: 15px; }
    .exp-header { display: flex; justify-content: space-between; align-items: baseline; }
    .exp-company { font-weight: bold; font-size: 11pt; }
    .exp-time { font-size: 10pt; color: #666; }
    .exp-type { font-size: 9pt; color: #fff; background: #666; padding: 1px 6px; border-radius: 3px; margin-left: 8px; }
    .skills-section { margin-bottom: 15px; }
    .skill-group { margin-bottom: 10px; }
    .skill-name { font-weight: bold; font-size: 11pt; }
    .skill-level { font-size: 9pt; color: #666; margin-left: 8px; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9pt; color: #999; text-align: center; }
    @media print {
      body { padding: 20px 30px; }
      h2.section-title { page-break-after: avoid; }
      .exp-item, .project-item, .skill-group { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <h2 class="subtitle">${escapeHtml(job)}</h2>
  
  <div class="info-grid">
    ${infoItems.map(item => `<span class="info-item">${escapeHtml(item)}</span>`).join('')}
  </div>
  
  <div class="contact-grid">
    ${contactLinks.map(c => `<span class="contact-item"><a href="${c.href}">${escapeHtml(c.text)}</a></span>`).join('')}
  </div>
  
  <h2 class="section-title">技术栈</h2>
  <ul>
    ${skillsItems.map(item => `<li>${escapeHtml(item)}</li>`).join('\n    ')}
  </ul>
  
  <h2 class="section-title">自我评价</h2>
  <ul>
    ${selfItems.map(item => `<li>${escapeHtml(item)}</li>`).join('\n    ')}
  </ul>
  
  <h2 class="section-title">个人经历</h2>
  ${experiences.map(exp => `
  <div class="exp-item">
    <div class="exp-header">
      <span class="exp-company">${escapeHtml(exp.company)}</span>
      <span><span class="exp-time">${escapeHtml(exp.time)}</span><span class="exp-type">${escapeHtml(exp.type)}</span></span>
    </div>
    ${exp.desc ? `<p class="meta">${escapeHtml(exp.desc)}</p>` : ''}
    <ul>
      ${exp.items.map(item => `<li>${escapeHtml(item.replace(/<[^>]+>/g, ''))}</li>`).join('\n      ')}
    </ul>
  </div>`).join('')}
  
  <h2 class="section-title">项目经验</h2>
  ${renderProjects([...projectsLeft, ...projectsRight])}
  
  <h2 class="section-title">开源项目</h2>
  ${renderOpenSourceProjects(openSourceProjects)}
  
  <h2 class="section-title">技能</h2>
  <div class="skills-section">
    ${skills.map(s => `
    <div class="skill-group">
      <span class="skill-name">${escapeHtml(s.name)}</span><span class="skill-level">(${escapeHtml(s.level)})</span>
      <ul>
        ${s.items.map(item => `<li>${escapeHtml(item.replace(/<[^>]+>/g, ''))}</li>`).join('\n        ')}
      </ul>
    </div>`).join('')}
  </div>
  
  <h2 class="section-title">开发工具</h2>
  <ul>
    ${tools.map(t => `<li>${escapeHtml(t.replace(/<[^>]+>/g, ''))}</li>`).join('\n    ')}
  </ul>
  
  <div class="footer">最后更新于2026年3月</div>
</body>
</html>`;
}

function extractProjects(html) {
  if (!html) return [];
  const projects = [];
  const categoryRegex = /<div class="item">\s*<header class="item-hd">\s*<a[^>]*>([^<]+)<\/a>\s*<\/header>\s*<div class="item-bd">\s*<dl>([\s\S]*?)<\/dl>/g;
  let match;
  while ((match = categoryRegex.exec(html)) !== null) {
    const category = match[1].trim();
    const content = match[2];
    const items = [];
    const dtRegex = /<dt>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/dt>((?:\s*<dd>[^<]*<\/dd>)*)/g;
    let dtMatch;
    while ((dtMatch = dtRegex.exec(content)) !== null) {
      const ddRegex = /<dd>([^<]*)<\/dd>/g;
      const details = [];
      let ddMatch;
      while ((ddMatch = ddRegex.exec(dtMatch[2])) !== null) {
        if (ddMatch[1].trim()) details.push(ddMatch[1].trim());
      }
      items.push({ title: dtMatch[1].trim(), details });
    }
    if (items.length) projects.push({ category, items });
  }
  return projects;
}

function extractOpenSourceProjects(html) {
  if (!html) return [];
  const projects = [];
  const categoryRegex = /<div class="item">\s*<header class="item-hd">\s*<a[^>]*>([^<]+)<\/a>\s*<\/header>\s*<div class="item-bd">\s*<ul>([\s\S]*?)<\/ul>/g;
  let match;
  while ((match = categoryRegex.exec(html)) !== null) {
    const category = match[1].trim();
    const items = [];
    const liRegex = /<li>\s*(?:<a[^>]*href="([^"]*)"[^>]*>)?([^<]+)(?:<\/a>)?\s*([^<]*)/g;
    let liMatch;
    while ((liMatch = liRegex.exec(match[2])) !== null) {
      items.push({
        href: liMatch[1] || '',
        name: liMatch[2].trim(),
        desc: liMatch[3].trim()
      });
    }
    if (items.length) projects.push({ category, items });
  }
  return projects;
}

function extractSkills(html) {
  if (!html) return [];
  const skills = [];
  const skillRegex = /<div class="item">\s*<header class="item-hd">\s*<span class="item-time">([^<]+)<\/span>\s*<a[^>]*>([^<]+)<\/a>\s*<\/header>\s*<div class="item-bd">\s*<ul class="section-content">([\s\S]*?)<\/ul>/g;
  let match;
  while ((match = skillRegex.exec(html)) !== null) {
    const items = [];
    const liRegex = /<li>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/li>/g;
    let liMatch;
    while ((liMatch = liRegex.exec(match[3])) !== null) {
      items.push(liMatch[1].trim());
    }
    skills.push({ name: match[1].trim(), level: match[2].trim(), items });
  }
  return skills;
}

function renderProjects(projects) {
  return projects.map(p => `
  <h3 class="category">${escapeHtml(p.category)}</h3>
  ${p.items.map(item => `
  <div class="project-item">
    <dt>${escapeHtml(item.title)}</dt>
    ${item.details.map(d => `<dd>${escapeHtml(d)}</dd>`).join('\n    ')}
  </div>`).join('')}`).join('');
}

function renderOpenSourceProjects(projects) {
  return projects.map(p => `
  <h3 class="category">${escapeHtml(p.category)}</h3>
  <ul>
    ${p.items.map(item => `<li><strong>${escapeHtml(item.name)}</strong> ${escapeHtml(item.desc)}</li>`).join('\n    ')}
  </ul>`).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
