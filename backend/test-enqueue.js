require('dotenv').config();

async function testEnqueue() {
  console.log("Testing Backend Enqueue...");
  const WORKER_SECRET = process.env.RENDER_WORKER_SECRET || process.env.WORKER_SECRET || "123456789"; // Adjust as needed
  
  const opts = {
    accountId: "6e994005-542b-4873-83b2-197e4c1a17ee",
    userId: "134edb12-671b-467a-be4a-763d62dda983",
    recipientId: "123456789",
    messagePayload: { text: "Testing enqueue" },
    messageType: "comment_reply",
    automationRuleId: "2660007e-a839-4ab3-8b9d-0bf2e35601d3",
    scheduledSendAt: new Date().toISOString(),
  };
  
  try {
    const res = await fetch(`https://content-engineer-api.onrender.com/api/messaging/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
      body: JSON.stringify(opts),
    });
    
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
  } catch (e) {
    console.log("Error:", e.message);
  }
}

testEnqueue();
