require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const upload = multer();
const PORT = process.env.PORT || 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
const WEBHOOK_URL = `${process.env.PUBLIC_URL}/api/form/submit`;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const checkedForms = new Set();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  checkAndAddWebhooks();
  setInterval(checkAndAddWebhooks, 1000);
});

async function checkAndAddWebhooks() {
  try {
    const response = await axios.get(`https://eu-api.jotform.com/user/forms?apiKey=${JOTFORM_API_KEY}`);
    const forms = response.data.content;

    if (Array.isArray(forms)) {
      for (const form of forms) {
        const formID = form.id;

        if (!checkedForms.has(formID)) {
          await ensureWebhookExists(formID);
          checkedForms.add(formID);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (error) {
    console.error('Error fetching forms from JotForm:', error.response ? error.response.data : error);
  }
}

async function ensureWebhookExists(formID) {
  try {
    const webhooksResponse = await axios.get(`https://eu-api.jotform.com/form/${formID}/webhooks?apiKey=${JOTFORM_API_KEY}`);
    const webhooks = webhooksResponse.data.content;

    const webhookURLs = Object.values(webhooks);
    if (webhookURLs.includes(WEBHOOK_URL)) {
      console.log(`Webhook for form ${formID} already exists.`);
    } else {
      await createWebhook(formID);
    }
  } catch (error) {
    console.error(`Error checking webhook for form ${formID}:`, error.response ? error.response.data : error);
  }
}

async function createWebhook(formID) {
  try {
    const webhookResponse = await axios({
      method: 'post',
      url: `https://eu-api.jotform.com/form/${formID}/webhooks?apiKey=${JOTFORM_API_KEY}`,
      data: new URLSearchParams({ webhookURL: WEBHOOK_URL }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log(`Webhook created for form ${formID}:`, webhookResponse.data);
  } catch (error) {
    console.error(`Error creating webhook for form ${formID}:`, error.response ? error.response.data : error);
  }
}

app.post('/api/form/submit', upload.none(), async (req, res) => {
  console.log('Headers:', req.headers);
  console.log('Received data:', req.body);

  const formData = req.body;
  const { formID } = formData;

  if (!formID) {
    return res.status(400).send('formID is required');
  }

  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS form_${formID} (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
    await pool.query(createTableQuery);

    const fields = Object.keys(formData).filter(field => field !== 'formID');
    for (const field of fields) {
      const alterTableQuery = `
        ALTER TABLE form_${formID}
        ADD COLUMN IF NOT EXISTS ${field.toLowerCase()} TEXT`;
      await pool.query(alterTableQuery);
    }

    const insertQuery = `
      INSERT INTO form_${formID} (${fields.map(field => field.toLowerCase()).join(', ')})
      VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')})`;
    await pool.query(insertQuery, fields.map(field => formData[field]));

    res.status(200).send('Data saved successfully');
  } catch (error) {
    console.error('Error saving data to database:', error);
    res.status(500).send('Error saving data');
  }
});

app.post('/api/form/addWebhook', async (req, res) => {
  const { formID } = req.body;
  if (!formID) {
    return res.status(400).send('formID is required');
  }

  try {
    await ensureWebhookExists(formID);
    res.status(200).send(`Webhook added for form ${formID}`);
  } catch (error) {
    console.error(`Error adding webhook for form ${formID}:`, error);
    res.status(500).send('Error adding webhook');
  }
});
