// backend/server.js

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
// ... otras importaciones

// Configuración de Firebase Admin SDK
// ¡IMPORTANTE! Asegúrate de que las credenciales no estén hardcodeadas.
// Debes obtenerlas de variables de entorno en producción.
// Por ejemplo, usando una variable de entorno para el JSON de credenciales o sus partes.

// EJEMPLO de cómo cargar credenciales de forma segura
// Si tienes un archivo JSON de credenciales, puedes leerlo como una variable de entorno en Render.
// O pasar cada campo como una variable de entorno separada (más seguro).
// Por ahora, asumiremos que usarás una variable de entorno llamada FIREBASE_SERVICE_ACCOUNT.
// (Render te permitirá configurar esto más adelante)
// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Si prefieres usar variables de entorno para cada parte de las credenciales, sería algo así:
const serviceAccount = {
  "type": process.env.FIREBASE_TYPE,
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined, // Manejar saltos de línea
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL,
  "universe_domain": process.env.FIREBASE_UNIVERSE_DOMAIN
};


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // Exporta db para usarlo en tus rutas

const app = express();
const PORT = process.env.PORT || 3001; // Render asignará un PORT dinámicamente

app.use(cors()); // Permite CORS para que el frontend pueda comunicarse
app.use(express.json()); // Habilita el parsing de JSON en el cuerpo de las solicitudes

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Backend de Diario de Trading funcionando!');
});

// Ruta para exportar a Excel
app.get('/api/trades/export-excel', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).send('User ID is required.');
    }

    try {
        const tradesRef = db.collection('users').doc(userId).collection('trades');
        const snapshot = await tradesRef.get();

        if (snapshot.empty) {
            return res.status(404).send('No trades found for this user.');
        }

        let csv = "Date,Ticker,Position Type,Contracts,Entry Price,Exit Price,Contract Size,Initial Margin,Fees and Slippage,Profit/Loss,Notes\n";
        snapshot.forEach(doc => {
            const data = doc.data();
            const profitLoss = (data.positionType === 'long')
                ? (data.exitPrice - data.entryPrice) * data.contracts * data.contractSize - (data.feesAndSlippage || 0)
                : (data.entryPrice - data.exitPrice) * data.contracts * data.contractSize - (data.feesAndSlippage || 0);

            csv += `${data.date},${data.ticker},${data.positionType},${data.contracts},${data.entryPrice},${data.exitPrice},${data.contractSize},${data.initialMargin || 0},${data.feesAndSlippage || 0},${profitLoss.toFixed(2)},"${data.notes.replace(/"/g, '""')}"\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('trades_export.csv');
        res.send(csv);

    } catch (error) {
        console.error('Error exporting trades:', error);
        res.status(500).send('Error exporting trades.');
    }
});


app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});