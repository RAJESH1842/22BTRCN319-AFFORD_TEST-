# Afford URL Shortener 🚀

A simple URL shortening service built with **Node.js**, **Express**, and **MongoDB**.  
Create short URLs, track their usage, and manage expiry times.

---

## Features

- Shorten any valid URL
- Set custom validity time for short links
- Track clicks, including timestamp, IP, and referrer
- Auto-expire URLs after validity period
- Logs all requests

---

## API Endpoints

### 1. Create Short URL
- **Method:** POST  
- **URL:** `/shorturls`  
- **Headers:** `Content-Type: application/json`  
- **Body:**
```json
{
  "url": "https://example.com",

Response:
{
  "shortLink": "http://localhost:3005/abc123",
  "expiry": "2025-09-18T18:50:00.000Z"
}

2. Get Short URL Stats

Method: GET

URL: /shorturls/:code

Response:

{
  "shortcode": "abc123",
  "originalUrl": "https://example.com",
  "createdAt": "2025-09-18T17:50:00.000Z",
  "expiryAt": "2025-09-18T18:50:00.000Z",
  "totalClicks": 0,
  "clicks": []
}

3. Redirect Short URL

Method: GET

URL: /:code

Behavior: Redirects to the original URL if not expired.

Installation

Clone the repo:

git clone <repo-url>
cd affordmed-url-shortener


Install dependencies:

npm install


Create a .env file:

PORT=3005
MONGO_URI=<your-mongodb-uri>
BASE_URL=http://localhost:3005


Start the server:

nodemon index.js

Testing with Postman

POST /shorturls → Create a short URL

GET /shorturls/:code → Get stats

GET /:code → Redirect to original URL

Example POST request in Postman:

URL: http://localhost:3005/shorturls

Body:

{
  "url": "https://example.com",
  "validity": 60
}

Logs

All request logs and errors are stored in the logs/ folder.

Tech Stack

Node.js & Express

MongoDB & Mongoose

Nanoid for shortcodes

dotenv for environment variables

  "validity": 60,   // optional in minutes
  "shortcode": "abc123"  // optional custom shortcode
}
