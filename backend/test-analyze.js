require('dotenv').config();
const { aggregateIntelligence } = require('./src/services/intelligence');

const dummyPosts = [
  { id: '1', caption: 'How to learn SEO fast! #seo #marketing', likes: 100, comments: 20, views: 1000, type: 'VIDEO' },
  { id: '2', caption: 'The dark reality of agencies...', likes: 500, comments: 150, views: 5000, type: 'VIDEO' }
];

try {
  const result = aggregateIntelligence(dummyPosts);
  console.log("Success! Result:", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Error:", e);
}
