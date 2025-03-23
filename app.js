const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const https = require('https'); // 引入 https 模块
const app = express();
// 协议校验函数 (示例，实际应用中可能需要更完善的实现)
async function checkHttps(domain) {
  return new Promise((resolve) => {
    const req = https.request({
      host: domain,
      port: 443,
      method: 'HEAD',
    }, (res) => {
      resolve(true); // 支持 HTTPS
      req.destroy();
    }).on('error', (err) => {
      resolve(false); // 不支持 HTTPS
      req.destroy();
    });
    req.end();
  });
}
// 动态设置反向代理
const apiProxy = createProxyMiddleware({
  changeOrigin: true, // 修改请求头中的 Origin 为目标域名
  router: async (req) => {
    // 从 URL 中提取目标域名
    const target = req.url.split('/')[1]; // 获取第一个斜杠后的内容作为目标域名
    // 协议校验
    const useHttps = await checkHttps(target);
    const protocol = useHttps ? 'https' : 'http';
    return {
      target: `${protocol}://${target}`, // 目标域名
      headers: {
        host: target,
      },
    };
  },
  pathRewrite: (path, req) => {
    const target = req.url.split('/')[1];
    const newPath = path.replace(`/${target}`, '');
    return newPath;
  },
  onProxyReq: (proxyReq, req, res) => {
    // 移除所有隐私相关的请求头
    const privacyHeaders = [
      'x-forwarded-for', // 客户端 IP
      'x-real-ip', // 客户端真实 IP
      'cf-connecting-ip', // Cloudflare 客户端 IP
      'true-client-ip', // 客户端真实 IP
      'forwarded', // 代理链信息
      'via', // 代理链信息
      'x-cluster-client-ip', // 集群客户端 IP
      'x-forwarded-host', // 原始主机信息
      'x-forwarded-proto', // 原始协议信息
      'x-originating-ip', // 原始 IP
      'x-remote-ip', // 远程 IP
      'x-remote-addr', // 远程地址
      'x-envoy-external-address', // Envoy 外部地址
      'x-amzn-trace-id', // AWS 跟踪 ID
      'x-request-id', // 请求 ID
      'x-correlation-id', // 关联 ID
    ];
    privacyHeaders.forEach((header) => proxyReq.removeHeader(header));
  },
  onProxyRes: (proxyRes, req, res) => {
    // 移除所有隐私相关的响应头
    const privacyHeaders = [
      'x-powered-by', // 服务器技术信息
      'server', // 服务器信息
      'x-request-id', // 请求 ID
      'x-correlation-id', // 关联 ID
      'x-amzn-trace-id', // AWS 跟踪 ID
      'via', // 代理链信息
      'cf-ray', // Cloudflare 信息
      'x-envoy-upstream-service-time', // Envoy 上游服务时间
    ];
    privacyHeaders.forEach((header) => delete proxyRes.headers[header]);
  },
  onError: (err, req, res) => { // 错误处理
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error occurred.');
  },
});
// 使用反向代理中间件, 拦截所有请求
app.use('/', apiProxy);
// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
