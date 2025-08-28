// 只导入我们验证所必需的飞书模块
const lark = require('@larksuiteoapi/node-sdk');

// 只初始化飞书客户端
const feishuClient = new lark.Client({
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
});

// Vercel 主处理函数
module.exports = async (req, res) => {
    // 飞书的 Webhook 验证流程
    // 这是代码中唯一会执行的部分
    if (req.body && req.body.challenge) {
        console.log("接收到飞书的 URL 验证请求，正在响应...");
        return res.status(200).json({ challenge: req.body.challenge });
    }

    // 对于其他所有请求（包括浏览器直接访问），都回复这个
    res.status(200).send("这是一个用于飞书机器人验证的端点。");
};
