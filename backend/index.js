import * as dotenv from "dotenv";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

dotenv.config();
app.use(express.json());

const GOOGLE_OAUTH_URL = process.env.GOOGLE_OAUTH_URL;
const GOOGLE_CLIENT_ID = process.env.CLIENT_ID;
const GOOGLE_CALLBACK_URL = process.env.REDIRECT_URI;
const GOOGLE_OAUTH_SCOPES = [
"https://www.googleapis.com/auth/userinfo.email",
"https://www.googleapis.com/auth/userinfo.profile",
"https://www.googleapis.com/auth/business.manage",
];

app.get("/", async (req, res) => {
  const state = "some_state";
  const scopes = GOOGLE_OAUTH_SCOPES.join(" ");
  const GOOGLE_OAUTH_CONSENT_SCREEN_URL = `${GOOGLE_OAUTH_URL}?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_CALLBACK_URL)}&access_type=offline&response_type=code&state=${state}&scope=${scopes}`;

  console.log('Redirect URL:', GOOGLE_OAUTH_CONSENT_SCREEN_URL);
  res.redirect(GOOGLE_OAUTH_CONSENT_SCREEN_URL);
});

const GOOGLE_ACCESS_TOKEN_URL = process.env.GOOGLE_ACCESS_TOKEN_URL;

app.get("/google/callback", async (req, res) => {
  const { code } = req.query;

  const data = {
    code,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI,
    grant_type: "authorization_code",
  };

  try {
    // exchange authorization code for access token
    const response = await fetch(GOOGLE_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange error:', errorText);
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await response.json();
    console.log('Token data:', {
      ...tokenData,
      access_token: 'REDACTED' // Don't log the actual token
    });

    // After successful authentication, redirect to frontend with both tokens
    res.redirect(
      `http://localhost:5173/dashboard?token=${tokenData.access_token}&id_token=${tokenData.id_token}`
    );
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint to fetch business reviews
app.get("/api/business-reviews/:placeId", async (req, res) => {
  try {
    const { placeId } = req.params;
    const response = await fetch(
      `${GOOGLE_PLACES_API_URL}/details/json?place_id=${placeId}&fields=reviews&key=${process.env.GOOGLE_PLACES_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Places API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data.result?.reviews || []);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews', details: error.message });
  }
});


const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place';

// Add the search places endpoint
app.get("/api/search-places", async (req, res) => {
  try {
    const { query } = req.query;
    const response = await fetch(
      `${GOOGLE_PLACES_API_URL}/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Places API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Return more detailed place information
    const places = data.results.map(place => ({
      place_id: place.place_id,
      name: place.name,
      location_id: place.id, // This will be used for the reviews API
      formatted_address: place.formatted_address
    }));

    res.json(places);
  } catch (error) {
    console.error('Error searching places:', error);
    res.status(500).json({ error: 'Failed to search places', details: error.message });
  }
});


app.post("/api/reply-to-review", async (req, res) => {
  try {
    const { reviewId, replyText, placeId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    console.log('Token:', token); // Debug token
    console.log('Review ID:', reviewId);
    console.log('Place ID:', placeId);

    // 1. First get the accounts list with error logging
    try {
      const accountsResponse = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts', // Updated API endpoint
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('Accounts API Error:', {
          status: accountsResponse.status,
          statusText: accountsResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to fetch accounts: ${accountsResponse.status} - ${errorText}`);
      }

      const accountsData = await accountsResponse.json();
      console.log('Accounts data:', accountsData);

      if (!accountsData.accounts || accountsData.accounts.length === 0) {
        throw new Error('No business accounts found');
      }

      const accountName = accountsData.accounts[0].name;
      const accountId = accountName.split('/')[1];

      // 2. Get the locations for this account
      const locationsResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!locationsResponse.ok) {
        const errorText = await locationsResponse.text();
        throw new Error(`Failed to fetch locations: ${locationsResponse.status} - ${errorText}`);
      }

      const locationsData = await locationsResponse.json();
      console.log('Locations data:', locationsData);

      // Find the location that matches our place_id
      const location = locationsData.locations.find(loc => loc.metadata?.placeId === placeId);

      if (!location) {
        throw new Error('Location not found for the given place ID');
      }

      const locationId = location.name.split('/')[3];

      // 3. Business Profile API to reply to the review
      const response = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            comment: replyText
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Google API Error Response:', errorText);
        throw new Error(`Failed to reply to review: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json({ success: true, data });

    } catch (error) {
      console.error('Detailed error:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error replying to review:', error);
    res.status(500).json({
      error: 'Failed to reply to review',
      details: error.message
    });
  }
});

// to check if the token is valid or not
async function validateToken(token) {
  try {
    const response = await fetch(
      'https://oauth2.googleapis.com/tokeninfo',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    return await response.json();
  } catch (error) {
    console.error('Token validation error:', error);
    throw error;
  }
}

// Update the business-reviews endpoint
app.get("/api/business-reviews", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Validate the token first
    await validateToken(token);

    // Use the Places API to get reviews
    const response = await fetch(
      `${GOOGLE_PLACES_API_URL}/details/json?place_id=${process.env.PLACE_ID}&fields=reviews&key=${process.env.GOOGLE_PLACES_API_KEY}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch reviews: ${response.status}`);
    }

    const data = await response.json();
    res.json(data.result?.reviews || []);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      error: 'Failed to fetch reviews',
      details: error.message
    });
  }
});


const PORT = 5000;

const start = async (port) => {
  app.listen(port, () => {
    console.log(`Server running on port: http://localhost:${port}`);
  });
};


start(PORT);
