// 【乱码修复版】
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const APP_ID = Deno.env.get("FEISHU_APP_ID");
const APP_SECRET = Deno.env.get("FEISHU_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
async function getTenantAccessToken() {
  console.log("[授权处理器] 正在获取一个全新的 tenant_access_token...");
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      app_id: APP_ID,
      app_secret: APP_SECRET
    })
  });
  const data = await response.json();
  if (data.code === 0) {
    console.log("[授权处理器] 成功获取 tenant_access_token！");
    return data.tenant_access_token;
  } else {
    throw new Error("获取 tenant_access_token 失败: " + data.msg);
  }
}
serve(async (req)=>{
  console.log("--- [OAuth回调处理器] 函数启动 ---");
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    const errorMessage = "[错误] 此函数被调用，但URL中没有找到'code'参数！";
    console.error(errorMessage);
    return new Response(`<h1>错误</h1><p>${errorMessage}</p>`, {
      status: 400
    });
  }
  console.log(`[回调] 检测到授权码'code': ${code}`);
  try {
    const tenantAccessToken = await getTenantAccessToken();
    const requestUrl = "https://open.feishu.cn/open-apis/authen/v1/access_token";
    const requestHeaders = {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Bearer ${tenantAccessToken}`
    };
    const requestBody = {
      grant_type: "authorization_code",
      code: code
    };
    const tokenResponse = await fetch(requestUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    });
    const rawResponseText = await tokenResponse.text();
    console.log(`[回调] 收到飞书的原始响应体: ${rawResponseText}`);
    const tokenData = JSON.parse(rawResponseText);
    if (tokenData.code !== 0) {
      throw new Error(`换取Token失败: ${tokenData.msg}`);
    }
    console.log("[回调] 成功换取Token！");
    const userData = tokenData.data;
    const userOpenId = userData.open_id;
    await supabase.from('feishu_tokens').upsert({
      user_open_id: userOpenId,
      access_token: userData.access_token,
      refresh_token: userData.refresh_token,
      expires_in: userData.expires_in,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_open_id'
    });
    console.log("[回调] Token成功存入数据库！");
    return new Response("<h1>授权成功！</h1><p>您已成功授权AI日程助手。现在您可以关闭这个页面，回到飞书开始对话了。</p>", {
      headers: {
        // --- 【核心修正1】在这里加上 "; charset=utf-8" ---
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  } catch (e) {
    console.error("--- [OAuth回调处理器] 出现严重错误！ ---", e);
    return new Response(`<h1>授权失败</h1><p>错误信息: ${e.message}</p>`, {
      headers: {
        // --- 【核心修正2】在这里也加上 "; charset=utf-8" ---
        "Content-Type": "text/html; charset=utf-8"
      },
      status: 500
    });
  }
});
