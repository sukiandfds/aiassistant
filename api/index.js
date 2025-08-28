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
        const model = genAI.getGenerativeModel({ model: "gemini-flash-2.5", tools: tools });
        const chat = model.startChat();
        const result = await chat.sendMessage("东京的天气怎么样？");
        
        // 检查AI是否要调用工具
        const call = result.response.functionCalls()[0];
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
            res.status(500).send("验证失败：AI没有按预期调用工具。");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(`出错了: ${error.message}`);
    }
};
