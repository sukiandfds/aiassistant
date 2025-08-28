// 导入我们需要的两个工具库
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 这是Vercel处理所有请求的函数
module.exports = async (req, res) => {
    try {
        // --- 第1部分：连接到 Supabase 数据库 ---

        // 从环境变量中获取 Supabase 的地址和钥匙
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        // 检查地址和钥匙是否存在
        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Supabase URL 或 Key 未在环境变量中设置！");
        }

        // 创建一个 Supabase 客户端实例
        const supabase = createClient(supabaseUrl, supabaseKey);

        // --- 第2部分：从数据库读取数据 ---

        // 尝试从 'long_term_memories' 表中读取所有数据
        const { data, error } = await supabase
            .from('long_term_memories')
            .select('*');

        // 如果读取过程中发生错误，就抛出错误
        if (error) {
            throw new Error(`读取 Supabase 数据失败: ${error.message}`);
        }

        // --- 第3部分：将结果返回给用户 ---

        // 将我们从数据库中读取到的数据（JSON格式）发送回浏览器页面
        // `JSON.stringify(data, null, 2)` 是为了让数据显示得更整齐好看
        res.status(200).json({
            message: "成功从 Supabase 读取数据！",
            data: data
        });

    } catch (error) {
        // 如果中间任何一步出错了，就打印错误日志，并返回错误信息
        console.error("函数运行时捕获到错误:", error);
        res.status(500).send(`函数运行时捕获到错误: ${error.message}`);
    }
};
