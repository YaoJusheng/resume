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

      await publishGhPages();

      // 调用 Chrome 渲染出 PDF 文件
      const chromePath = findChrome();
      console.log('chromePath: '+ chromePath);
      console.log('outputPath: '+ outputPath);
      spawnSync(chromePath, [
        '--headless',
        '--disable-gpu',
        '--print-to-pdf-no-header',      // 兼容旧版 Chrome
        `--print-to-pdf=${path.resolve(outputPath, 'resume.pdf')}`,
        'https://yaojusheng.github.io/resume/' // 这里注意改成你的在线简历的网站
      ]);

      // 重新发布到 ghpages
      await publishGhPages();
    }),
  ]
};
