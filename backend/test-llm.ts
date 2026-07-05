import { callLLM } from "./src/services/llm";
import { config } from "dotenv";
config();
process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
async function test() {
  try {
    const res = await callLLM({
      userId: "134edb12-671b-467a-be4a-763d62dda983",
      endpoint: "audit",
      prompt: "say hello",
      systemPrompt: "you are a bot"
    });
    console.log(res);
  } catch (e) {
    console.error("FAIL:", e);
  }
}
test();
