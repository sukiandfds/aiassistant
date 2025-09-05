import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";
// 一个懂得调用【最终版资料员】并进行最终回复的管家
serve(async (req)=>{
  console.log("【最终版管家】启动...");
  try {
    const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY"));
    const userQuery = "我应该什么时候安排时间来写“龙抬头”项目的报告？";
    console.log(`【管家】收到的问题是: "${userQuery}"`);
    // --- 1. AI决策 (这部分不变) ---
    const decisionModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });
    const decisionPrompt = `用户的请求是：“${userQuery}”。这个请求是否需要查询外部知识？请只回答“是”或“否”。`;
    const decisionResult = await decisionModel.generateContent(decisionPrompt);
    const decision = decisionResult.response.text().trim();
    console.log(`【管家】AI的判断是：“${decision}”`);
    let finalAnswerForUser = "";
    if (decision.includes("是")) {
      console.log("【管家】判断需要帮助，正在呼叫【资料员】...");
      // --- 2. 【如何修复URL问题】 ---
      // 我们使用 new URL() 这个标准方法。它能自动处理好所有的斜杠问题，
      // 确保无论 SUPABASE_URL 变量末尾有没有斜杠，最终生成的地址都是
      // 规范的、正确的。这是最健壮、最推荐的做法。
      const retrieverUrl = new URL('/functions/v1/quick-task', Deno.env.get("SUPABASE_URL")).href;
      console.log(`【管家】已构造出健壮的URL: ${retrieverUrl}`);
      const response = await fetch(retrieverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get("SUPABASE_ANON_KEY"),
          'Authorization': 'Bearer ' + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        },
        body: JSON.stringify({
          query: userQuery
        })
      });
      if (!response.ok) throw new Error("调用资料员失败！" + await response.text());
      // --- 3. 接收资料员的真实答案 ---
      const { retrieved_answer } = await response.json();
      console.log(`【管家】收到了资料员的真实回答：“${retrieved_answer}”`);
      // --- 4. 【画龙点睛】管家将事实包装成更自然的对话 ---
      console.log("【管家】正在将事实包装成更友好的回复...");
      const finalPrompt = `你是一个乐于助人的AI管家。你的资料员刚刚帮你查到了以下信息：“${retrieved_answer}”。请你根据这些信息，用自然、友好的语气，重新组织一下语言，回答用户最初的问题：“${userQuery}”`;
      const finalModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
      });
      const finalResult = await finalModel.generateContent(finalPrompt);
      finalAnswerForUser = finalResult.response.text();
    } else {
      finalAnswerForUser = "这是一个闲聊问题，我们可以聊点别的！";
    }
    console.log(`【管家】准备给您的最终回复是：“${finalAnswerForUser}”`);
    return new Response(JSON.stringify({
      final_answer: finalAnswerForUser
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("【管家】出现严重错误！", e);
    return new Response(e.message, {
      status: 500
    });
  }
});
