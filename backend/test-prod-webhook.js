require('dotenv').config();

async function testProd() {
  const opts = {
    accountId: "6e994005-542b-4873-83b2-197e4c1a17ee",
    userId: "134edb12-671b-467a-be4a-763d62dda983",
    recipientId: "17928515790125844",
    messagePayload: { text: "check dm first" },
    messageType: "comment_reply",
    automationRuleId: "2660007e-a839-4ab3-8b9d-0bf2e35601d3",
    scheduledSendAt: new Date().toISOString(),
  };

  const WORKER_SECRET = "contentiq_worker_secret_2025";

  try {
    const res = await fetch(`https://content-engineer-api.onrender.com/api/messaging/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
      body: JSON.stringify(opts),
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Result:", data);
  } catch(e) {
    console.log("Error:", e.message);
  }
}
testProd();
