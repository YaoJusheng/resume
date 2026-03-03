// 导出 PDF：从 DOM 提取内容，分页构建后逐页截图导出（支持中文，避免文字断裂）
import html2canvas from "html2canvas";
import JsPDF from "jspdf";

function h2pcustom() {
  console.log("开始从 DOM 提取内容并生成 PDF");

  // 创建临时渲染容器（自动高度，显示所有内容）
  var renderContainer = document.createElement("div");
  renderContainer.id = "pdf-render-container";
  renderContainer.style.cssText = "position:absolute;left:-9999px;top:0;width:515px;background:#fff;padding:40px;font-family:'Microsoft YaHei',Arial,sans-serif;color:#333;line-height:1.5;";
  document.body.appendChild(renderContainer);

  // 辅助函数：创建元素
  function create(tag, styles, text) {
    var el = document.createElement(tag);
    if (styles) {
      Object.keys(styles).forEach(function(key) {
        el.style[key] = styles[key];
      });
    }
    if (text) el.textContent = text;
    // 添加CSS避免分页时元素断裂
    if (tag !== 'li' && tag !== 'span') {
      el.style.pageBreakInside = 'avoid';
      el.style.breakInside = 'avoid';
    }
    return el;
  }

  // 样式配置对象
  var styles = {
    header: { textAlign: "right", fontSize: "10px", color: "#999", marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "10px" },
    h1: { fontSize: "28px", margin: "10px 0", fontWeight: "bold" },
    h2: { fontSize: "16px", margin: "5px 0 20px 0", color: "#666" },
    sectionTitle: { fontSize: "14px", margin: "15px 0 8px 0", color: "#555", borderBottom: "2px solid #ddd", paddingBottom: "5px" },
    mainTitle: { fontSize: "18px", margin: "25px 0 12px 0", fontWeight: "bold", borderBottom: "3px solid #333", paddingBottom: "5px" },
    categoryTitle: { fontSize: "14px", margin: "15px 0 8px 0", color: "#0070c0", fontWeight: "bold" },
    companyTitle: { fontSize: "14px", margin: "0", fontWeight: "bold" },
    skillTitle: { fontSize: "13px", margin: "12px 0 5px 0", fontWeight: "bold", color: "#333" },
    meta: { fontSize: "11px", color: "#666", margin: "3px 0" },
    text: { fontSize: "12px", margin: "8px 0", color: "#555" },
    ul: { margin: "5px 0", paddingLeft: "20px", fontSize: "11px" },
    li: { margin: "2px 0" },
    projectItem: { fontSize: "12px", fontWeight: "bold", margin: "5px 0" },
    projectDesc: { fontSize: "11px", color: "#555", margin: "3px 0 3px 15px" },
    footer: { marginTop: "30px", paddingTop: "10px", borderTop: "1px solid #eee", fontSize: "9px", color: "#aaa", textAlign: "center" }
  };

  // 通用内容提取器
  var extractors = {
    // 提取基本信息
    basicInfo: function() {
      renderContainer.appendChild(create("div", styles.header, "简历 | Mr. Yao"));
      
      var name = document.querySelector(".name h1");
      if (name) renderContainer.appendChild(create("h1", styles.h1, name.textContent.trim()));
      
      var job = document.querySelector(".job h2");
      if (job) renderContainer.appendChild(create("h2", styles.h2, job.textContent.trim()));
    },

    // 提取列表型section（个人信息、联系方式、技术栈、自我评价）
    listSection: function(selector, title, emoji) {
      var items = document.querySelectorAll(selector);
      if (!items.length) return;
      
      renderContainer.appendChild(create("h3", styles.sectionTitle, emoji + title));
      var ul = create("ul", styles.ul);
      
      items.forEach(function(item) {
        var text = item.textContent.trim();
        if (text && !text.includes(title)) {
          ul.appendChild(create("li", styles.li, text));
        }
      });
      renderContainer.appendChild(ul);
    },

    // 提取联系方式（特殊处理链接）
    contactSection: function() {
      renderContainer.appendChild(create("h3", styles.sectionTitle, "2️⃣[联系方式]"));
      var ul = create("ul", styles.ul);
      
      document.querySelectorAll(".contact li").forEach(function(li) {
        var link = li.querySelector(".contact-link");
        if (link) {
          var text = link.textContent.trim();
          var a = li.querySelector("a");
          if (a && a.href && !a.href.startsWith("mailto:")) text += " (" + a.href + ")";
          ul.appendChild(create("li", styles.li, text));
        }
      });
      renderContainer.appendChild(ul);
    },

    // 提取个人经历
    experienceSection: function() {
      renderContainer.appendChild(create("h2", styles.mainTitle, "个人经历"));
      
      document.querySelectorAll(".practice .item").forEach(function(item) {
        var company = item.querySelector(".item-name");
        if (!company) return;
        
        var wrapper = create("div", { marginTop: "15px" });
        wrapper.appendChild(create("h4", styles.companyTitle, company.textContent.trim()));
        
        var time = item.querySelector(".item-time");
        var type = item.querySelector(".item-more");
        var metaText = "";
        if (time) metaText += time.textContent.trim();
        if (type) metaText += " 至 " + type.textContent.trim();
        if (metaText) wrapper.appendChild(create("div", styles.meta, metaText));
        
        var desc = item.querySelector(".item-des");
        if (desc) wrapper.appendChild(create("p", styles.text, desc.textContent.trim()));
        
        var ul = create("ul", styles.ul);
        item.querySelectorAll(".section-content li").forEach(function(li) {
          ul.appendChild(create("li", styles.li, li.textContent.trim()));
        });
        wrapper.appendChild(ul);
        renderContainer.appendChild(wrapper);
      });
    },

    // 提取项目经验
    projectSection: function(selector, title) {
      var section = document.querySelector(selector);
      if (!section) return;
      
      var titleEl = section.querySelector(".section-title");
      renderContainer.appendChild(create("h2", styles.mainTitle, titleEl ? titleEl.textContent.trim() : title));
      
      section.querySelectorAll(".item").forEach(function(item) {
        var category = item.querySelector(".item-more");
        if (category) {
          renderContainer.appendChild(create("h3", styles.categoryTitle, category.textContent.trim()));
        }
        
        item.querySelectorAll("dt").forEach(function(dt) {
          var wrapper = create("div", { marginTop: "10px", marginLeft: "10px" });
          wrapper.appendChild(create("div", styles.projectItem, "• " + dt.textContent.trim()));
          
          var dd = dt.nextElementSibling;
          while (dd && dd.tagName === "DD") {
            wrapper.appendChild(create("div", styles.projectDesc, dd.textContent.trim()));
            dd = dd.nextElementSibling;
          }
          renderContainer.appendChild(wrapper);
        });
      });
    },

    // 提取开源项目（不同结构）
    openSourceSection: function() {
      var section = document.querySelector(".content-right .project");
      if (!section) return;
      
      var titleEl = section.querySelector(".section-title");
      renderContainer.appendChild(create("h2", styles.mainTitle, titleEl ? titleEl.textContent.trim() : "开源项目"));
      
      section.querySelectorAll(".item").forEach(function(item) {
        var category = item.querySelector(".item-more");
        if (category) {
          renderContainer.appendChild(create("h3", styles.categoryTitle, category.textContent.trim()));
        }
        
        item.querySelectorAll("ul li").forEach(function(li) {
          renderContainer.appendChild(create("div", Object.assign({}, styles.projectDesc, { marginLeft: "20px" }), "• " + li.textContent.trim()));
        });
      });
    },

    // 提取技能部分
    skillSection: function() {
      var section = document.querySelector(".content-right .skill");
      if (!section) return;
      
      renderContainer.appendChild(create("h2", styles.mainTitle, "技能"));
      
      section.querySelectorAll(".item").forEach(function(item) {
        var skillName = item.querySelector(".item-time");
        var skillLevel = item.querySelector(".item-more");
        
        if (skillName) {
          var header = skillName.textContent.trim();
          if (skillLevel) header += " - " + skillLevel.textContent.trim();
          renderContainer.appendChild(create("h4", styles.skillTitle, header));
        }
        
        var ul = create("ul", styles.ul);
        item.querySelectorAll(".section-content li").forEach(function(li) {
          ul.appendChild(create("li", styles.li, li.textContent.trim()));
        });
        if (ul.children.length > 0) renderContainer.appendChild(ul);
      });
    },

    // 提取开发工具
    toolSection: function() {
      var section = document.querySelector(".content-right .dev-tool");
      if (!section) return;
      
      renderContainer.appendChild(create("h2", styles.mainTitle, "开发工具"));
      
      section.querySelectorAll(".section-content li").forEach(function(li) {
        renderContainer.appendChild(create("div", Object.assign({}, styles.projectDesc, { marginLeft: "20px" }), "• " + li.textContent.trim()));
      });
    },

    // 提取页脚
    footer: function() {
      var modified = document.querySelector(".last-modified");
      var text = modified ? modified.textContent.trim() : "最后更新于2026年2月";
      renderContainer.appendChild(create("div", styles.footer, text));
    }
  };

  // 执行内容提取（顺序执行）
  extractors.basicInfo();
  extractors.listSection(".info li", "[个人信息]", "1️⃣");
  extractors.contactSection();
  extractors.listSection(".skills li", "[技术栈]", "3️⃣");
  extractors.listSection(".self-assess li", "[自我评价]", "4️⃣");
  extractors.experienceSection();
  extractors.projectSection(".content-left .project", "项目经验");
  extractors.openSourceSection();
  extractors.skillSection();
  extractors.toolSection();
  extractors.footer();

  // 智能分页：测量元素高度并在适当位置插入分页标记
  var pdfPageHeight = 841.89; // A4纸高度(pt)
  var containerWidth = 595; // 容器宽度约等于A4宽度(pt) 
  var scale = 2; // html2canvas 缩放比例
  var pageHeightInPx = (pdfPageHeight * containerWidth / 595.28) - 20; // 预留边距
  
  var children = Array.from(renderContainer.children);
  var currentHeight = 0;
  var pageBreakMarkers = [];
  
  children.forEach(function(child, index) {
    var rect = child.getBoundingClientRect();
    var elementHeight = rect.height;
    
    // 如果加上当前元素会超过一页高度，在前一个元素后插入分页标记
    if (currentHeight + elementHeight > pageHeightInPx && currentHeight > 0) {
      pageBreakMarkers.push(index);
      currentHeight = elementHeight; // 重置高度计数器
    } else {
      currentHeight += elementHeight;
    }
  });
  
  // 在标记位置插入分页div
  pageBreakMarkers.reverse().forEach(function(index) {
    var pageBreak = document.createElement("div");
    pageBreak.className = "page-break-marker";
    pageBreak.style.cssText = "height:50px;page-break-after:always;break-after:page;";
    renderContainer.insertBefore(pageBreak, children[index]);
  });

  // 使用 html2canvas 截图渲染容器
  return html2canvas(renderContainer, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false
  }).then(function(canvas) {
    // 清理临时容器
    document.body.removeChild(renderContainer);

    var pdf = new JsPDF("p", "pt", "a4");
    var pdfWidth = 595.28;
    var pdfHeight = 841.89;
    
    // canvas 尺寸（已按 scale=2 放大）
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;
    
    // 计算缩放比例：PDF 宽度 / Canvas 宽度
    var ratio = pdfWidth / canvasWidth;
    
    // 每页在 canvas 上的实际高度（扣除缩放）
    var pageHeightInCanvas = pdfHeight / ratio;
    
    // 需要的总页数
    var totalPages = Math.ceil(canvasHeight / pageHeightInCanvas);
    
    console.log("Canvas尺寸:", canvasWidth, "x", canvasHeight, "总页数:", totalPages);

    // 逐页裁剪并添加到 PDF
    for (var i = 0; i < totalPages; i++) {
      // 当前页在 canvas 上的起始 y 坐标
      var srcY = i * pageHeightInCanvas;
      // 当前页的实际高度（最后一页可能不足）
      var srcHeight = Math.min(pageHeightInCanvas, canvasHeight - srcY);
      
      // 创建临时 canvas 用于裁剪
      var pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvasWidth;
      pageCanvas.height = srcHeight;
      var ctx = pageCanvas.getContext("2d");
      
      // 从原始 canvas 裁剪当前页
      ctx.drawImage(
        canvas,
        0, srcY,              // 源起点
        canvasWidth, srcHeight,  // 源尺寸
        0, 0,                 // 目标起点
        canvasWidth, srcHeight   // 目标尺寸
      );
      
      // 转为图片数据
      var pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      
      // 添加到 PDF（第一页无需 addPage）
      if (i > 0) {
        pdf.addPage();
      }
      
      // 计算当前页在 PDF 中的高度
      var pdfPageHeight = srcHeight * ratio;
      pdf.addImage(pageImgData, "JPEG", 0, 0, pdfWidth, pdfPageHeight);
    }

    pdf.save("resume.pdf");
  }).catch(function(err) {
    // 清理临时容器（失败时也要清理）
    if (renderContainer.parentNode) {
      document.body.removeChild(renderContainer);
    }
    console.error("PDF 生成失败：", err);
    alert("PDF 生成失败，请查看控制台错误信息");
    throw err;
  });
}

export default h2pcustom;
