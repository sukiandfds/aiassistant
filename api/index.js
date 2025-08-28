// 导入Gemini库
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 从环境变量中获取API密钥
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 定义我们的“天气”工具
const tools = [{
    functionDeclarations: [{
        name: "get_weather",
        description: "获取特定地点的天气",
        parameters: {
            type: "OBJECT",
            properties: { location: { type: "STRING", description: "城市名" } },
            required: ["location"],
        },
    }],
}];

// 这是Vercel处理请求的函数
module.exports = async (req, res) => {
    try {
        // 检查API密钥是否存在
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY 环境变量未设置！");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", tools: tools });
        const chat = model.startChat();
        const result = await chat.sendMessage("东京的天气怎么样？");
        
        // --- 开始进行更安全的检查 ---
        const functionCalls = result.response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            
            if (call.name === "get_weather") {
                // 成功了！AI想要调用我们的工具
                // 我们直接返回一个固定的“晴天”结果
                const apiResponse = {
                    functionResponse: {
                        name: "get_weather",
                        response: { name: "get_weather", content: { weather: "晴天" } },
                    }
                };
                
                // 把“晴天”的结果喂回给AI
                const result2 = await chat.sendMessage([apiResponse]);
                const finalResponse = result2.response.text();

                // 将AI最终的回答发送给用户
                res.status(200).send(`验证成功！AI的回答是: "${finalResponse}"`);
            } else {
                // AI调用了我们不认识的工具
                res.status(500).send(`验证失败：AI调用了未知的工具: ${call.name}`);
            }
        } else {
            // --- 这是关键的新增部分 ---
            // AI没有调用任何工具，而是直接给出了回答
            const modelResponseText = result.response.text();
            res.status(500).send(`验证失败：AI没有调用工具，而是直接回答: "${modelResponseText}"`);
        }
        // --- 安全检查结束 ---

    } catch (error) {
        // 将详细错误打印到Vercel的日志中，方便我们查看
        console.error("函数运行时捕获到错误:", error); 
        // 向用户返回一个清晰的错误信息
        res.status(500).send(`函数运行时捕获到错误: ${error.message}`);
    }
};
