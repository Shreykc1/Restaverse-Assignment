// Load environment variables from .env file
require('dotenv').config();
const express = require("express");
const { google } = require("googleapis");
const { OAuth2 } = google.auth;

const app = express();
const port = 3000;

// Set up OAuth2 client using environment variables
const oAuth2Client = new OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Scopes required for the API
const SCOPES = ['https://www.googleapis.com/auth/business.manage', 'https://www.googleapis.com/auth/userinfo.profile'];

// Function to authenticate and get an OAuth token
async function authenticate(req, res) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  res.redirect(authUrl);
}

// Callback endpoint for OAuth2
async function oauth2callback(req, res) {
  const code = req.query.code;

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  res.send("Authentication successful! You can now fetch reviews.");
}

// Fetch reviews from Google My Business or Google Places API
async function fetchReviews(req, res) {
  try {
    const mybusiness = google.mybusinessbusinessinformation({
      version: "v1",
      auth: oAuth2Client
    });

    // Use the business account's location ID (replace with actual location ID)
    const locationId = 'YOUR_LOCATION_ID'; // You need to get this from the business registration process

    const response = await mybusiness.accounts.locations.reviews.list({
      name: `accounts/{accountId}/locations/${locationId}`
    });

    res.json(response.data);
  } catch (err) {
    res.status(500).send("Error fetching reviews: " + err.message);
  }
}

// Routes
app.get("/auth", authenticate);
app.get("/oauth2callback", oauth2callback);
app.get("/reviews", fetchReviews);

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
