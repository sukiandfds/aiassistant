// 文件路径: feishu-handler/util_feishu.ts
// 【最终健壮版 - 包含Token自动刷新】
import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { supabase } from "./util_database.ts"; // 导入 supabase 客户端
// --- 从环境变量中获取所有凭证 ---
const APP_ID = Deno.env.get("FEISHU_APP_ID");
const APP_SECRET = Deno.env.get("FEISHU_APP_SECRET");
const ENCRYPT_KEY = Deno.env.get("FEISHU_ENCRYPT_KEY");
// --- 现有函数 (保持不变) ---
let tokenCache = {
  token: "",
  expire: 0
};
export async function getTenantAccessToken() {
  // ... (您现有的 getTenantAccessToken 代码保持不变)
  if (tokenCache.token && Date.now() < tokenCache.expire) return tokenCache.token;
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
  if (data.code !== 0) throw new Error("Failed to get tenant_access_token: " + data.msg);
  tokenCache.token = data.tenant_access_token;
  tokenCache.expire = Date.now() + (data.expire - 120) * 1000;
  return tokenCache.token;
}
export async function replyMessage(receiveId, content) {
  // ... (您现有的 replyMessage 代码保持不变)
  try {
    const accessToken = await getTenantAccessToken();
    const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "text",
        content: JSON.stringify({
          text: content
        })
      })
    });
    console.log("成功向FEISHU发送回复!");
  } catch (e) {
    console.error("回复FEISHU消息时失败:", e);
  }
}
export async function decrypt(encryptedBase64) {
  // ... (您现有的 decrypt 代码保持不变)
  const key = createHash("sha256").update(ENCRYPT_KEY).digest();
  const encryptedBytes = Uint8Array.from(atob(encryptedBase64), (c)=>c.charCodeAt(0));
  const iv = encryptedBytes.slice(0, 16);
  const data = encryptedBytes.slice(16);
  const cryptoKey = await crypto.subtle.importKey("raw", key, {
    name: "AES-CBC"
  }, false, [
    "decrypt"
  ]);
  const decrypted = await crypto.subtle.decrypt({
    name: "AES-CBC",
    iv
  }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}
// --- 【新增的核心逻辑：用户凭证自动刷新】 ---
async function refreshUserAccessToken(refreshToken) {
  console.log("[Token刷新] 检测到Token过期，开始刷新...");
  const tenantAccessToken = await getTenantAccessToken();
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v1/refresh_access_token", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tenantAccessToken}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  const data = await response.json();
  if (data.code !== 0) throw new Error(`刷新User Access Token失败: ${data.msg}`);
  console.log("[Token刷新] 成功获取新的Token！");
  return data.data;
}
export async function getUserAccessToken(userOpenId) {
  console.log(`[Token管理] 开始为用户 [${userOpenId}] 获取有效凭证...`);
  const { data, error } = await supabase.from('feishu_tokens').select('access_token, refresh_token, updated_at, expires_in').eq('user_open_id', userOpenId).single();
  if (error || !data) {
    console.error(`[Token管理] 数据库中未找到用户 [${userOpenId}] 的授权信息。`, error);
    return null;
  }
  const expireTime = new Date(data.updated_at).getTime() + data.expires_in * 1000;
  if (Date.now() >= expireTime - 300 * 1000) {
    try {
      const newTokens = await refreshUserAccessToken(data.refresh_token);
      await supabase.from('feishu_tokens').update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: newTokens.expires_in,
        updated_at: new Date().toISOString()
      }).eq('user_open_id', userOpenId);
      console.log(`[Token管理] Token已刷新并存入数据库，返回新的Token。`);
      return newTokens.access_token;
    } catch (e) {
      console.error(`[Token管理] 刷新Token时出现严重错误:`, e);
      return null;
    }
  } else {
    console.log(`[Token管理] Token有效，直接使用。`);
    return data.access_token;
  }
}
