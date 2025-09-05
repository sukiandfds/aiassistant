// 文件路径: feishu-handler/tool_calendar.ts
// 【最终写入版 - 包含创建/修改/删除功能和海量调试信息】
import { getUserAccessToken } from "./util_feishu.ts";
// --- 内部辅助函数，用于获取主日历ID，避免在每个函数中重复代码 ---
async function _getPrimaryCalendarId(userAccessToken) {
  console.log("[日历工具-调试] (内部辅助) 开始获取主日历ID...");
  const getCalendarsUrl = `https://open.feishu.cn/open-apis/calendar/v4/calendars`;
  const calendarsResponse = await fetch(getCalendarsUrl, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${userAccessToken}`
    }
  });
  const calendarsData = await calendarsResponse.json();
  console.log(`[日历工具-调试] (内部辅助) 收到日历列表响应: ${JSON.stringify(calendarsData)}`);
  if (calendarsData.code !== 0) {
    throw new Error(`(内部辅助) 获取日历列表失败，飞书返回: ${calendarsData.msg}`);
  }
  const primaryCalendar = calendarsData.data.calendar_list.find((cal)=>cal.type === 'primary');
  if (!primaryCalendar) {
    throw new Error("(内部辅助) 在用户的日历列表中未找到 'primary' 类型的主日历。");
  }
  const primaryCalendarId = primaryCalendar.calendar_id;
  console.log(`[日历工具-调试] (内部辅助) 成功找到主日历ID: ${primaryCalendarId}`);
  return primaryCalendarId;
}
// --- 现有函数：查询日程 (保持不变) ---
export async function getCalendarEvents(userOpenId, startTimeRFC, endTimeRFC) {
  // ... 您现有的、已经可以工作的 getCalendarEvents 代码 ...
  // 为了完整性，我们把它也放在这里
  console.log("==========================================================");
  console.log(`[查询日程-调试] 函数开始执行。 User: ${userOpenId}`);
  try {
    const userAccessToken = await getUserAccessToken(userOpenId);
    if (!userAccessToken) throw new Error("无法获取有效的用户访问凭证。");
    const primaryCalendarId = await _getPrimaryCalendarId(userAccessToken);
    const startTimeUnix = Math.floor(new Date(startTimeRFC).getTime() / 1000);
    const endTimeUnix = Math.floor(new Date(endTimeRFC).getTime() / 1000);
    const listEventsUrl = `https://open.feishu.cn/open-apis/calendar/v4/calendars/${primaryCalendarId}/events?start_time=${startTimeUnix}&end_time=${endTimeUnix}&timezone=Asia/Shanghai`;
    const eventsResponse = await fetch(listEventsUrl, {
      headers: {
        "Authorization": `Bearer ${userAccessToken}`
      }
    });
    const eventsData = await eventsResponse.json();
    if (eventsData.code !== 0) throw new Error(`获取日程列表失败，飞书返回: ${eventsData.msg}`);
    console.log(`[查询日程-调试] 成功获取日程列表！`);
    // 在查询结果中加入 event_id，这对修改和删除至关重要！
    if (eventsData.data.items && eventsData.data.items.length > 0) {
      const formattedEvents = eventsData.data.items.map((event)=>{
        const start = new Date(parseInt(event.start_time.timestamp) * 1000).toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai'
        });
        const end = new Date(parseInt(event.end_time.timestamp) * 1000).toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai'
        });
        return `- 日程: "${event.summary}", 时间: 从 ${start} 到 ${end}, [ID: ${event.event_id}]`; // <-- 增加了ID
      }).join("\n");
      return `在您的【主日历】上找到以下日程：\n${formattedEvents}`;
    } else {
      return "在这段时间内，您的【主日历】上没有任何日程安排。";
    }
  } catch (e) {
    console.error("[查询日程-调试] 出现严重错误:", e);
    return `在查询日历时遇到一个内部错误: ${e.message}`;
  }
}
// 在 feishu-handler/tool_calendar.ts 文件中，替换这个函数
export async function createCalendarEvent(userOpenId, summary, startTime, endTime, description, attendeeOpenIds, createVideoMeeting) {
  console.log("==========================================================");
  console.log(`[创建日程-调试] 函数开始执行。 User: ${userOpenId}`);
  // ... 其他参数日志 ...
  console.log(`[创建日程-调试] 参数 - AI提供的开始时间: ${startTime}`);
  console.log(`[创建日程-调试] 参数 - AI提供的结束时间: ${endTime}`);
  try {
    const userAccessToken = await getUserAccessToken(userOpenId);
    if (!userAccessToken) throw new Error("无法获取有效的用户访问凭证。");
    const primaryCalendarId = await _getPrimaryCalendarId(userAccessToken);
    console.log(`[创建日程-调试] 准备构建请求体 (Request Body)...`);
    // --- 【核心修正】将RFC3339字符串强制转换为Unix时间戳 ---
    const startTimeUnix = Math.floor(new Date(startTime).getTime() / 1000);
    const endTimeUnix = Math.floor(new Date(endTime).getTime() / 1000);
    console.log(`[创建日程-调试] 转换后 - 开始时间戳: ${startTimeUnix}`);
    console.log(`[创建日程-调试] 转换后 - 结束时间戳: ${endTimeUnix}`);
    // 检查转换结果是否有效
    if (isNaN(startTimeUnix) || isNaN(endTimeUnix)) {
      throw new Error(`AI提供的时间格式无法被正确解析: start='${startTime}', end='${endTime}'`);
    }
    const body = {
      summary: summary,
      start_time: {
        timestamp: startTimeUnix.toString()
      },
      end_time: {
        timestamp: endTimeUnix.toString()
      },
      reminders: [
        {
          type: 'popup',
          minutes: 15
        }
      ]
    };
    // ... 后续构建 body 的逻辑不变 ...
    if (description) body.description = description;
    if (attendeeOpenIds && attendeeOpenIds.length > 0) {
      body.attendees = attendeeOpenIds.map((id)=>({
          user_id: id,
          user_id_type: 'open_id'
        }));
    }
    if (createVideoMeeting) body.video_meeting = {
      enable: true
    };
    console.log(`[创建日程-调试] 最终构建的请求体: ${JSON.stringify(body, null, 2)}`);
    const createUrl = `https://open.feishu.cn/open-apis/calendar/v4/calendars/${primaryCalendarId}/events`;
    const response = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${userAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    console.log(`[创建日程-调试] 收到飞书的创建响应: ${JSON.stringify(data)}`);
    if (data.code !== 0) {
      // 增加更详细的错误日志
      throw new Error(`创建日程失败，飞书返回: ${data.msg}. 详情: ${data.error?.details ? JSON.stringify(data.error.details) : '无'}`);
    }
    console.log("[创建日程-调试] 函数成功执行！");
    return `日程 "${summary}" 已成功创建！日程ID为: ${data.data.event.event_id}`;
  } catch (e) {
    console.error("[创建日程-调试] 出现严重错误:", e);
    return `创建日程时遇到一个内部错误: ${e.message}`;
  }
}
// --- 【新功能 2：修改日程】 ---
export async function updateCalendarEvent(userOpenId, eventId, summary, startTime, endTime, description, attendeeOpenIds) {
  console.log("==========================================================");
  console.log(`[修改日程-调试] 函数开始执行。 User: ${userOpenId}, EventID: ${eventId}`);
  try {
    const userAccessToken = await getUserAccessToken(userOpenId);
    if (!userAccessToken) throw new Error("无法获取有效的用户访问凭证。");
    const primaryCalendarId = await _getPrimaryCalendarId(userAccessToken);
    const body = {};
    if (summary) body.summary = summary;
    if (startTime) body.start_time = {
      rfc3339: startTime
    };
    if (endTime) body.end_time = {
      rfc3339: endTime
    };
    if (description) body.description = description;
    if (attendeeOpenIds) {
      body.attendees = attendeeOpenIds.map((id)=>({
          user_id: id,
          user_id_type: 'open_id'
        }));
    }
    if (Object.keys(body).length === 0) {
      return "错误：您没有提供任何需要修改的信息。";
    }
    console.log(`[修改日程-调试] 最终构建的请求体: ${JSON.stringify(body, null, 2)}`);
    const updateUrl = `https://open.feishu.cn/open-apis/calendar/v4/calendars/${primaryCalendarId}/events/${eventId}`;
    const response = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${userAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    console.log(`[修改日程-调试] 收到飞书的修改响应: ${JSON.stringify(data)}`);
    if (data.code !== 0) {
      throw new Error(`修改日程失败，飞书返回: ${data.msg}`);
    }
    console.log("[修改日程-调试] 函数成功执行！");
    return `日程(ID: ${eventId})已成功更新！`;
  } catch (e) {
    console.error("[修改日程-调试] 出现严重错误:", e);
    return `修改日程时遇到一个内部错误: ${e.message}`;
  }
}
// --- 【新功能 3：删除日程】 ---
export async function deleteCalendarEvent(userOpenId, eventId) {
  console.log("==========================================================");
  console.log(`[删除日程-调试] 函数开始执行。 User: ${userOpenId}, EventID: ${eventId}`);
  try {
    const userAccessToken = await getUserAccessToken(userOpenId);
    if (!userAccessToken) throw new Error("无法获取有效的用户访问凭证。");
    const primaryCalendarId = await _getPrimaryCalendarId(userAccessToken);
    const deleteUrl = `https://open.feishu.cn/open-apis/calendar/v4/calendars/${primaryCalendarId}/events/${eventId}`;
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${userAccessToken}`
      }
    });
    const data = await response.json();
    console.log(`[删除日程-调试] 收到飞书的删除响应: ${JSON.stringify(data)}`);
    if (data.code !== 0) {
      throw new Error(`删除日程失败，飞书返回: ${data.msg}`);
    }
    console.log("[删除日程-调试] 函数成功执行！");
    return `日程(ID: ${eventId})已成功删除！`;
  } catch (e) {
    console.error("[删除日程-调试] 出现严重错误:", e);
    return `删除日程时遇到一个内部错误: ${e.message}`;
  }
}
