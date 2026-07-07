async function fetchFreeModels() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const data = await res.json();
  const freeModels = data.data.filter(m => m.id.includes("free"));
  console.log("Free models:", freeModels.map(m => m.id).join(", "));
}
fetchFreeModels();
