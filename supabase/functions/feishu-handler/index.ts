// 文件路径: feishu-handler/index.ts
// --- 1. 引入所有必要的模块，包括我们新增的监控工具！ ---
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";
import { decrypt, replyMessage } from "./util_feishu.ts";
import { getHistory, saveHistory, clearHistory } from "./util_database.ts";
import { callRetriever } from "./tool_knowledge.ts";
import { getCalendarEvents } from "./tool_calendar.ts";
import { logPerformanceMetrics } from "./util_monitor.ts"; // <-- 导入新工具
// --- 2. 获取凭证 ---
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const VERIFICATION_TOKEN = Deno.env.get("FEISHU_VERIFICATION_TOKEN");
// --- 3. 异步处理AI核心逻辑 (大脑) ---
async function handleFeishuEvent(eventData) {
  const senderId = eventData.event.sender.sender_id.open_id;
  // 初始化性能监控对象
  const metrics = {
    sessionId: senderId,
    userQuery: "N/A",
    tokenCount: "N/A",
    totalTime: 0,
    aiTime: 0,
    decision: "处理失败"
  };
  const totalStartTime = Date.now();
  try {
    if (eventData.event.sender.sender_type !== 'user') return;
    if (eventData.header.event_type !== "im.message.receive_v1") return;
    const userQuery = JSON.parse(eventData.event.message.content).text.trim();
    metrics.userQuery = userQuery; // 记录用户问题
    const messageTimestamp = parseInt(eventData.event.message.create_time, 10);
    if ((Date.now() - messageTimestamp) / (1000 * 60) > 2) {
      console.log("[时间检查] 消息已过期，忽略。");
      return;
    }
    if (userQuery === '/reset') {
      await clearHistory(senderId);
      await replyMessage(senderId, "记忆已重置，我们可以开始一段全新的对话了。");
      return;
    }
    console.log(`[管家] 开始处理用户 [${senderId}] 的消息: "${userQuery}"`);
    await saveHistory(senderId, 'user', userQuery);
    const history = await getHistory(senderId);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const currentTimeString = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false
    });
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      // ---【1. 重写系统指令】---
      systemInstruction: `你是一个名叫 Lynn 的、高度专业化的AI日程管理助手。
      规则：
      1.  你的【唯一】信息来源是你拥有的工具。绝对不要依赖你的内部知识来回答关于用户个人信息的问题。
      2.  当被问及用户的“日程”、“安排”、“日历”或“有没有空”时，你【必须】使用 'get_calendar_events' 工具来查找答案。
      3.  当被问及用户的“项目”、“喜好”、“笔记”或任何需要长期记忆的知识时，你【必须】使用 'knowledge_retriever' 工具来查找答案。
      4.  如果工具返回的结果是空的或没有相关信息，你就必须诚实地告诉用户“根据我现有的资料，我没有找到关于...的信息”，而不是自己编造答案。
      5.  当前时间是: ${currentTimeString}。在调用工具时，请使用 RFC3339 格式 (例如 '2025-09-03T10:00:00+08:00') 来表示时间参数。`,
      tools: [
        {
          functionDeclarations: [
            // ---【2. 优化工具描述】---
            {
              name: "knowledge_retriever",
              // 描述更具引导性
              description: "使用此工具来回答任何关于用户的【长期知识】的问题，例如：项目信息、个人偏好、会议纪要、任务笔记等。",
              parameters: {
                type: "OBJECT",
                properties: {
                  query: {
                    type: "STRING"
                  }
                },
                required: [
                  "query"
                ]
              }
            },
            {
              name: "get_calendar_events",
              // 描述更具引导性
              description: "使用此工具来回答任何关于用户的【日程安排】的问题，例如：查询特定时间的日程、检查是否有空等。",
              parameters: {
                type: "OBJECT",
                properties: {
                  start_time: {
                    type: "STRING"
                  },
                  end_time: {
                    type: "STRING"
                  }
                },
                required: [
                  "start_time",
                  "end_time"
                ]
              }
            }
          ]
        }
      ]
    });
    // 测量Token压力
    const { totalTokens } = await model.countTokens({
      contents: [
        ...history,
        {
          role: 'user',
          parts: [
            {
              text: userQuery
            }
          ]
        }
      ]
    });
    metrics.tokenCount = totalTokens;
    const chat = model.startChat({
      history: history
    });
    // 测量AI思考时长
    const aiStartTime = Date.now();
    const result = await chat.sendMessage(userQuery);
    metrics.aiTime = Date.now() - aiStartTime;
    const response = result.response;
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      metrics.decision = `调用工具: ${call.name}`; // 记录决策
      let toolResult;
      if (call.name === 'knowledge_retriever') {
        toolResult = await callRetriever(call.args.query);
      } else if (call.name === 'get_calendar_events') {
        toolResult = await getCalendarEvents(senderId, call.args.start_time, call.args.end_time);
      }
      // 测量二次思考的时长
      const secondAiStartTime = Date.now();
      const finalResult = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: {
              content: toolResult
            }
          }
        }
      ]);
      metrics.aiTime += Date.now() - secondAiStartTime; // 累加二次思考时间
      const finalAnswer = finalResult.response.text();
      await replyMessage(senderId, finalAnswer);
      await saveHistory(senderId, 'assistant', finalAnswer);
    } else {
      metrics.decision = "直接回复"; // 记录决策
      const finalAnswer = response.text();
      await replyMessage(senderId, finalAnswer);
      await saveHistory(senderId, 'assistant', finalAnswer);
    }
    // 在成功处理后，记录完整的性能报告
    metrics.totalTime = Date.now() - totalStartTime;
    logPerformanceMetrics(metrics);
  } catch (e) {
    console.error("[管家] 核心逻辑出现严重错误:", e);
    // 在出错时，也记录一份包含部分信息的报告
    metrics.totalTime = Date.now() - totalStartTime;
    logPerformanceMetrics(metrics);
    if (senderId) await replyMessage(senderId, `抱歉，AI服务暂时繁忙或出现内部错误，请检查日志。`);
  }
}
// --- 5. 主服务逻辑 (快速响应) ---
serve(async (req)=>{
  const body = await req.json();
  if (body.type === "url_verification") {
    if (body.token !== VERIFICATION_TOKEN) return new Response("Forbidden", {
      status: 403
    });
    return new Response(JSON.stringify({
      challenge: body.challenge
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  (async ()=>{
    try {
      if (body.encrypt) {
        const decryptedBodyString = await decrypt(body.encrypt);
        const eventData = JSON.parse(decryptedBodyString);
        handleFeishuEvent(eventData);
      }
    } catch (e) {
      console.error("[主服务] 在后台异步处理时出错:", e);
    }
  })();
  return new Response("OK");
});
