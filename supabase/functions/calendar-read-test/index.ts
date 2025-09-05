// --- 1. 引入所有必要的模块 ---
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// --- 2. 从环境变量中获取所有凭证 ---
const APP_ID = Deno.env.get("FEISHU_APP_ID");
const APP_SECRET = Deno.env.get("FEISHU_APP_SECRET");
// --- 3. 获取应用令牌的辅助函数 ---
let tokenCache = {
  token: "",
  expire: 0
};
async function getTenantAccessToken() {
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
  if (data.code === 0) {
    tokenCache.token = data.tenant_access_token;
    tokenCache.expire = Date.now() + (data.expire - 120) * 1000;
    return tokenCache.token;
  } else {
    throw new Error("获取 tenant_access_token 失败: " + data.msg);
  }
}
// --- 4. 【核心】主服务逻辑 (最终完美版) ---
serve(async (req)=>{
  console.log("--- [日历读取测试 V4 - 最终版] 函数启动 ---");
  try {
    const accessToken = await getTenantAccessToken();
    const userOpenId = "ou_3d52ef72a2ffa8e8f9f09c65aa13fc92"; // 这是您自己的Open ID
    // ---【第一步：获取日历列表，找到主日历ID】---
    console.log("[第A步] 准备获取用户的日历列表...");
    const listCalendarsUrl = `https://open.feishu.cn/open-apis/calendar/v4/calendars`;
    const calendarsResponse = await fetch(listCalendarsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
        "X-User-ID-Type": "open_id",
        "X-User-ID": userOpenId
      }
    });
    const calendarsData = await calendarsResponse.json();
    if (calendarsData.code !== 0) {
      throw new Error(`获取日历列表失败: ${calendarsData.msg}`);
    }
    const primaryCalendar = calendarsData.data.calendar_list.find((cal)=>cal.type === 'primary');
    if (!primaryCalendar) {
      throw new Error("在返回的列表中没有找到主日历(type = 'primary')！");
    }
    const primaryCalendarId = primaryCalendar.calendar_id;
    console.log(`[第A步] 成功找到主日历ID: ${primaryCalendarId}`);
    // ---【第二步：使用正确的时间格式，获取日程列表】---
    console.log("[第B步] 准备使用正确ID和【Unix时间戳】获取日程列表...");
    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(startTime.getDate() + 7); // 查询未来7天
    // ---【已修正】将时间转换为以“秒”为单位的Unix时间戳 ---
    const startTimeUnix = Math.floor(startTime.getTime() / 1000);
    const endTimeUnix = Math.floor(endTime.getTime() / 1000);
    const listEventsUrl = `https://open.feishu.cn/open-apis/calendar/v4/calendars/${primaryCalendarId}/events?start_time=${startTimeUnix}&end_time=${endTimeUnix}`;
    console.log(`[第B步] 准备调用飞书API，URL: ${listEventsUrl}`);
    const eventsResponse = await fetch(listEventsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      }
    });
    console.log(`[第B步] 收到日程列表的响应，状态码: ${eventsResponse.status}`);
    const eventsData = await eventsResponse.json();
    if (eventsData.code !== 0) {
      console.error("[第B步] 获取日程列表失败！", eventsData);
      throw new Error(`获取日程列表失败: ${eventsData.msg}`);
    }
    console.log("[最终结果] 成功获取日程列表！完整内容如下：");
    console.log(JSON.stringify(eventsData, null, 2));
    return new Response(JSON.stringify(eventsData), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("--- [日历读取测试 V4 - 最终版] 出现严重错误！ ---", e);
    return new Response(JSON.stringify({
      error: e.message
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
