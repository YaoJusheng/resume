import './main.scss';

import h2pcustom from './html2pdf';

console.log(h2pcustom);

window.onload = function () {
  var downPdf = document.getElementById("btn-h2p");
  downPdf.onclick = h2pcustom();

}