const https = require('https'); 
const token = 'EAAVWPZCv8N8cBR2ZAxl5eeGYsN1ZA61M2AZAHT2B6nYb4tMp2cVA3kRouVhHCWeDj32B4fvrZCMf3trcTK5boZCxD6XbwfvZBhv2gbmhDGruKTeoZAHcZCKD1cI6pOS6DAM730E4tMOodsIxZCSLwFzKgyF2FCPGgAjhGSg8KASKmZBZCQHRLdhNBl3gZBOBXbzUOQFMw6pFZBgggZD'; 
const commentorId = '179090909090'; // Use the user's ID
const url = `https://graph.facebook.com/v21.0/815774163931754?fields=is_user_follow_business&access_token=${token}`; 

https.get(url, res => { 
  let data = ''; 
  res.on('data', chunk => data += chunk); 
  res.on('end', () => console.log('Response:', data)); 
}).on('error', err => console.error(err)); 
