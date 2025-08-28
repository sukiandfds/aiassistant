const lark = require('@larksuite/oapi');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- 初始化所有客户端 ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const feishuClient = new lark.Client({
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
});

// --- Vercel 主处理函数 ---
module.exports = async (req, res) => {
    // 飞书的 Webhook 验证
    if (req.body && req.body.challenge) {
        return res.status(200).json({ challenge: req.body.challenge });
    }

    // 确保这是一个飞书事件回调
    if (!(req.body && req.body.header && req.body.header.event_type === 'im.message.receive_v1')) {
        return res.status(200).send("事件类型不是 im.message.receive_v1，已忽略。");
    }

    // --- 主逻辑开始 ---
    try {
        const event = req.body.event;
        const message = JSON.parse(event.message.content);
        const userMessage = message.text.trim();
        const openId = event.sender.sender_id.open_id; // 获取用户的 open_id

        // 1. 从 Supabase 读取该用户的长期记忆
        const { data: memories, error } = await supabase
            .from('long_term_memories')
            .select('content')
            .eq('user_id', openId); // **重要：只读取这个用户的数据**

        if (error) throw new Error(`读取 Supabase 失败: ${error.message}`);
        const memoryContext = memories.map(m => m.content).join('\n');

        // 2. 构建 Prompt
        const prompt = `背景资料:\n---\n${memoryContext}\n---\n用户问题: "${userMessage}"`;

        // 3. 调用 Gemini 生成回答
        const result = await model.generateContent(prompt);
        const aiResponse = await result.response.text();
        
        // 4. 通过飞书 API 回复消息
        await feishuClient.im.message.reply({
            path: { message_id: event.message.message_id },
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
        res.status(200).json({ error: `函数运行时捕获到错误: ${error.message}` });
    }
};
