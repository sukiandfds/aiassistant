// 文件路径: feishu-handler/util_monitor.ts
// 打印性能“体检报告”的函数
export function logPerformanceMetrics(metrics) {
  console.log(`
--- 📊 AI 任务体检报告 📊 ---
*   用户ID (Session ID): ${metrics.sessionId}
*   用户问题: "${metrics.userQuery}"
*   
*   --- 压力指标 ---
*   上下文Token压力: ${metrics.tokenCount} tokens
*   
*   --- 耗时指标 ---
*   总处理时长: ${metrics.totalTime} ms
*   AI 思考时长: ${metrics.aiTime} ms
*   
*   --- 决策指标 ---
*   AI决策: ${metrics.decision}
*   --------------------------
  `);
}
