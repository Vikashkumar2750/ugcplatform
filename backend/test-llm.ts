require("dotenv/config");
const { callLLM } = require("./src/services/llm");

async function run() {
  try {
    const res = await callLLM({
      userId: "test-user-id", // mock user id
      endpoint: "audit",
      prompt: "Hello world",
      systemPrompt: "You are a bot"
    });
    console.log("Success:", res);
  } catch (err: any) {
    console.error("Caught error:", err);
    console.error("Message:", err.message);
    if (err.response) {
      console.error("Response:", err.response);
    }
  }
}

run();
