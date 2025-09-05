// 文件路径: feishu-handler/util_database.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// 从环境变量中获取凭证
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
export async function getHistory(sessionId) {
  const { data, error } = await supabase.from('conversation_history').select('role, content').eq('session_id', sessionId).order('created_at', {
    ascending: true
  });
  if (error) {
    console.error("读取历史记录失败:", error);
    throw error;
  }
  return data.map((item)=>({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [
        {
          text: item.content
        }
      ]
    }));
}
export async function saveHistory(sessionId, role, content) {
  const roleToSave = role === 'assistant' ? 'model' : 'user';
  const { error } = await supabase.from('conversation_history').insert({
    session_id: sessionId,
    role: roleToSave,
    content
  });
  if (error) console.error("保存历史记录失败:", error);
}
export async function clearHistory(sessionId) {
  console.log(`[重置] 收到指令，准备清空用户 [${sessionId}] 的对话历史...`);
  const { error } = await supabase.from('conversation_history').delete().eq('session_id', sessionId);
  if (error) {
    console.error("清空历史记录失败:", error);
    throw error;
  }
  console.log(`[重置] 用户 [${sessionId}] 的对话历史已成功清空。`);
}
