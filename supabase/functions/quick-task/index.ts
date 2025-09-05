import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";
// 资料员AI：只负责接收任务、查数据库、返回精准答案
serve(async (req)=>{
  console.log("【资料员】已启动，收到查询任务...");
  try {
    // --- 1. 初始化工具 ---
    const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY"));
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    // --- 2. 接收管家传来的问题 ---
    const { query } = await req.json();
    console.log(`【资料员】收到的查询问题是: "${query}"`);
    // --- 3. 从数据库读取所有知识 ---
    console.log("【资料员】正在读取数据库...");
    const { data: memories, error } = await supabase.from("knowledge_vectors").select("content");
    if (error) throw error;
    const memoryContext = memories.map((mem)=>mem.content).join("\n");
    console.log(`【资料员】读取到的知识如下：\n${memoryContext}`);
    // --- 4. 让AI根据知识，提炼出最精准的答案 ---
    console.log("【资料员】正在请求 Gemini-2.5-Flash 提炼答案...");
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });
    const prompt = `
      背景知识如下：
      ---
      ${memoryContext}
      ---
      请根据上面的背景知识，用一句话精准地、只说事实地回答这个问题：${query}
    `;
    const result = await model.generateContent(prompt);
    const answer = result.response.text();
    console.log(`【资料员】提炼出的精准答案是: "${answer}"`);
    // --- 5. 将精准答案返回给管家 ---
    return new Response(JSON.stringify({
      retrieved_answer: answer
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("【资料员】出现严重错误！", e);
    return new Response(JSON.stringify({
      error: e.message
    }), {
      status: 500
    });
  }
});
