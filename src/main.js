import './main.scss';

import h2pcustom from './html2pdf';

// 确保Google Fonts加载完成
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function() {
    console.log('Fonts loaded');
  });
}

window.onload = function () {
  var downPdf = document.getElementById("btn-h2p");
  // downPdf.onclick = h2pcustom();
  if (!downPdf) {
    return;
  }

  downPdf.onclick = async function (event) {
    event.preventDefault();

    if (downPdf.dataset.loading === "true") {
      return;
    }

    var originalText = downPdf.textContent;
    downPdf.dataset.loading = "true";
    downPdf.textContent = "正在生成...";
    downPdf.style.pointerEvents = "none";

    try {
      await h2pcustom();
    } finally {
      downPdf.dataset.loading = "false";
      downPdf.textContent = originalText;
      downPdf.style.pointerEvents = "auto";
    }
  };

}
