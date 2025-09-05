// 文件路径: feishu-handler/tool_knowledge.ts
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
export async function callRetriever(query) {
  console.log(`[管家] 准备调用资料员(quick-task)，查询: "${query}"`);
  const retrieverUrl = `${SUPABASE_URL}/functions/v1/quick-task`;
  const response = await fetch(retrieverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      query: query
    })
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("调用资料员失败！", errorBody);
    throw new Error(`调用资料员失败: ${errorBody}`);
  }
  const { retrieved_answer } = await response.json();
  console.log(`[管家] 从资料员处获得答案: "${retrieved_answer}"`);
  return retrieved_answer;
}
