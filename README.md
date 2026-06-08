# BTC 期权卖 Put 年化工具

这是一个纯前端静态网页工具，用浏览器请求 Binance European Options 公共行情接口，自动更新 BTC Put 标记价并计算卖 Put 年化收益。

第一版不需要 Binance API Key，不下单，不读取账户，也不需要 Node 后端服务。

## 功能

- 从 Binance 公共接口拉取 BTC 期权合约、mark price 和 BTC 指数价。
- 只展示未过期、交易中的 BTC Put 合约。
- 按参考价格自动选择附近行权价，支持 100 / 250 / 500 / 1000 / 2500 / 5000 行权价间隔。
- 默认展示 6 档附近行权价，也可以点击行权价锁定常看的价格。
- 支持切换收益口径：
  - 实际年化：`净权利金 / 每张保证金 * 365 / 剩余天数 * 100%`
  - 全担保年化：`净权利金 / 行权价 * 365 / 剩余天数 * 100%`
- 净权利金会扣除 Put 当前价内亏损：`markPrice - max(行权价 - BTC 指数价, 0)`。
- 默认每 30 秒自动刷新，也可以手动刷新。

## 本地运行

安装依赖：

```powershell
npm install
```

启动本地开发页面：

```powershell
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

本地开发时，Vite 会把同域 `/eapi/...` 请求代理到 `https://eapi.binance.com/eapi/...`，避免浏览器 CORS 报错。

## 编译和手动部署

编译静态文件：

```powershell
npm run build
```

编译完成后，把 `dist/` 目录里面的内容上传到服务器目录：

```text
/var/hundao/apps/2_options_calc/
```

上传后服务器目录应类似：

```text
/var/hundao/apps/2_options_calc/index.html
/var/hundao/apps/2_options_calc/assets/...
```

注意是上传 `dist` 里面的内容，不是把 `dist` 文件夹整体放进去。

生产 Nginx 需要额外把 `/eapi/` 反代到 Binance，例如：

```nginx
location /eapi/ {
    proxy_pass https://eapi.binance.com/eapi/;
    proxy_set_header Host eapi.binance.com;
    proxy_ssl_server_name on;
}
```

## 常用命令

```powershell
npm test
npm run build
```

## 数据来源

浏览器请求同域 `/eapi/...`，由 Vite 或 Nginx 转发到 Binance Options 公共接口：

- `/eapi/v1/exchangeInfo`
- `/eapi/v1/mark`
- `/eapi/v1/index?underlying=BTCUSDT`

当前权利金口径使用 option `markPrice`，不是 bid、ask 或 last price。

也可以通过 `VITE_BINANCE_API_BASE` 覆盖请求前缀，例如设置成 `https://example.com/eapi`。本项目不再提供 Node 后端服务。
