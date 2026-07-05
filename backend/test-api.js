require('dotenv').config();

const test = async () => {
  const token = ""; // We don't have a token. We can bypass auth for test.
  
  const res = await fetch("http://localhost:3001/api/analyze/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileUrl: "https://instagram.com/warikoo",
      platform: "instagram",
      niche: "Finance"
    })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}
test();
