// 遵照问题2的答案：导入正确的模块
const lark = require('@larksuiteoapi/node-sdk');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- 1. 初始化所有客户端 ---

// 遵照问题3的答案：初始化飞书客户端
const feishuClient = new lark.Client({
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
});

// 初始化 Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 初始化 Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


// --- 2. Vercel 主处理函数 ---
module.exports = async (req, res) => {
    // 飞书的 Webhook 验证流程
    if (req.body && req.body.challenge) {
        console.log("接收到飞书的 URL 验证请求，已成功响应。");
        return res.status(200).json({ challenge: req.body.challenge });
    }

    // 确保这是一个飞书消息事件
    if (!(req.body && req.body.header && req.body.header.event_type === 'im.message.receive_v1')) {
        return res.status(200).send("非目标事件类型，已忽略。");
    }

    // --- 3. 核心 AI 逻辑 ---
    try {
        const event = req.body.event;
        const message = JSON.parse(event.message.content);
        const userMessage = message.text.trim();
        const openId = event.sender.sender_id.open_id;
        const messageId = event.message.message_id;

        // 从 Supabase 读取记忆
        const { data: memories, error } = await supabase
            .from('long_term_memories')
            .select('content')
            .eq('user_id', openId);
        if (error) throw new Error(`读取 Supabase 失败: ${error.message}`);
        const memoryContext = memories.map(m => m.content).join('\n');

        // 构建 Prompt 并调用 AI
        const prompt = `背景资料:\n---\n${memoryContext}\n---\n用户问题: "${userMessage}"`;
        const result = await model.generateContent(prompt);
        const aiResponse = await result.response.text();
        
        // 使用客户端回复消息
        await feishuClient.im.message.reply({
            path: { message_id: messageId },
            data: {
                content: JSON.stringify({ text: aiResponse }),
                msg_type: 'text',
            },
        });

        // 告诉飞书服务器我们已成功处理
        res.status(200).send("处理成功");

    } catch (error) {
        console.error("函数运行时捕获到错误:", error);
        // 即使出错，也回复200，避免飞书重试
        res.status(200).send(`处理时出错: ${error.message}`);
    }
};
