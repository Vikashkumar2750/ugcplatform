async function testRapidAPI() {
  const res = await fetch("https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=warikoo", {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": "invalid_key",
      "X-RapidAPI-Host": "instagram-scraper-api2.p.rapidapi.com",
    },
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

testRapidAPI();
