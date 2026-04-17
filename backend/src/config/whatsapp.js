const axios = require('axios');
const { env } = require('./env');

const getWhatsAppClient = () => {
  const baseURL = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}`;

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${env.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
};

module.exports = { getWhatsAppClient };
