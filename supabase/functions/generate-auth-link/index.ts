// 文件路径: generate-auth-link/index.ts
// 【最终完整版】
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// --- 1. 从环境变量中获取凭证 ---
const APP_ID = Deno.env.get("FEISHU_APP_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
// --- 2. 主服务逻辑 ---
serve(async (req)=>{
  console.log("--- [链接生成器] 函数启动 ---");
  try {
    // 我们在飞书后台登记的那个URL
    const redirectUri = `${SUPABASE_URL}/functions/v1/feishu-oauth-handler`;
    // 根据官方文档，构建飞书授权页面的URL
    const authUrl = `https://open.feishu.cn/open-apis/authen/v1/index?redirect_uri=${encodeURIComponent(redirectUri)}&app_id=${APP_ID}`;
    console.log(`[链接生成器] 成功生成授权URL: ${authUrl}`);
    // 返回一个简单的HTML页面，上面有一个可以点击的链接，并清晰地显示了链接地址
    const html = `
      <html>
        <head>
          <title>飞书日历授权</title>
          <style>
            body { font-family: sans-serif; padding: 2em; }
            a { font-size: 1.2em; }
            p { margin-top: 1em; }
            code { background-color: #eee; padding: 0.2em 0.4em; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>步骤1：授权AI日程助手</h1>
          <p>请点击下面的链接，以授权AI日程助手访问您的飞书日历。授权成功后，您将会被自动带回。</p>
          <a href="${authUrl}">点击这里开始授权</a>
          <p><small>目标链接: <code>${authUrl}</code></small></p>
        </body>
      </html>
    `;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html"
      }
    });
  } catch (e) {
    console.error("--- [链接生成器] 出现严重错误！ ---", e);
    return new Response(`<h1>生成链接失败</h1><p>错误: ${e.message}</p>`, {
      status: 500
    });
  }
});
