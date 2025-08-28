// 导入我们需要的所有工具库
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- 初始化 Supabase 客户端 ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 初始化 Gemini AI 客户端 ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // 我们现在暂时不需要工具调用

// --- Vercel 主处理函数 ---
module.exports = async (req, res) => {
    // 飞书的 Webhook 验证流程
    // 当您在飞书后台配置 URL 时，飞书会发送一个包含 "challenge" 字段的请求来验证URL的有效性
    if (req.body && req.body.challenge) {
        console.log("接收到飞书的 URL 验证请求");
        return res.status(200).json({ challenge: req.body.challenge });
    }

    // --- 主逻辑开始 ---
    try {
        // 在真实场景中，我们会从 req.body 中解析飞书发来的用户消息
        // 为了测试，我们先写死一个用户问题
        const userMessage = "你好，请根据我的背景资料，总结一下我的工作模式。";
        console.log(`收到的模拟用户消息: ${userMessage}`);

        // 1. 从 Supabase 读取用户的长期记忆
        const { data: memories, error } = await supabase
            .from('long_term_memories')
            .select('content'); // 我们只选择 content 字段

        if (error) {
            throw new Error(`读取 Supabase 数据失败: ${error.message}`);
        }

        // 将记忆内容格式化成一个简单的字符串
        const memoryContext = memories.map(m => m.content).join('\n');
        console.log(`从数据库中提取的上下文: ${memoryContext}`);

        // 2. 构建给 AI 的指令 (Prompt)
        const prompt = `
            这是关于用户的一些背景资料：
            ---
            ${memoryContext}
            ---
            现在，请根据以上背景资料，回答用户的问题。
            用户问题: "${userMessage}"
        `;
        console.log("构建的最终 Prompt:", prompt);

        // 3. 调用 Gemini AI 生成回答
        const result = await model.generateContent(prompt);
        const aiResponse = await result.response.text();
        console.log(`Gemini 生成的回答: ${aiResponse}`);
        
        // 4. 将 AI 的回答返回
        // 在真实场景中，这里会是调用飞书 API 将消息发回给用户
        // 为了测试，我们先直接在页面上显示结果
        res.status(200).json({
            user_message: userMessage,
            memory_context: memoryContext,
            ai_response: aiResponse
        });

    } catch (error) {
        console.error("函数运行时捕获到错误:", error);
        res.status(500).json({ error: `函数运行时捕获到错误: ${error.message}` });
    }
};
