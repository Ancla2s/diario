// backend/server.js
const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const admin = require('firebase-admin'); // Importa firebase-admin

// Inicializa Firebase Admin SDK (REEMPLAZA CON LA RUTA A TU ARCHIVO JSON DE CLAVE DE SERVICIO)
const serviceAccount = require('./serviceAccountKey.json'); // Asegúrate de que este archivo exista en tu carpeta backend

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // Obtén la instancia de Firestore Admin

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// NOTA: Las rutas /api/trades (GET, POST, PUT, DELETE) originales YA NO SERÁN USADAS por el frontend de React
// porque el frontend ahora se comunica directamente con Firestore.
// Solo mantenemos la ruta de exportación.

// Ruta para exportar a Excel
app.get('/api/trades/export-excel', async (req, res) => {
    const userId = req.query.userId; // Obtén el userId desde la query string
    if (!userId) {
        return res.status(400).json({ error: 'Falta el ID de usuario para la exportación.' });
    }

    try {
        // Obtén los trades del usuario específico desde Firestore
        const tradesColRef = db.collection('users').doc(userId).collection('trades');
        const querySnapshot = await tradesColRef.get();
        const trades = querySnapshot.docs.map(doc => doc.data());

        if (trades.length === 0) {
            return res.status(404).json({ message: 'No hay operaciones para exportar para este usuario.' });
        }

        // Mapea los datos para que sean más legibles en Excel
        const dataToExport = trades.map(trade => ({
            Fecha: trade.date,
            Simbolo: trade.ticker,
            Posicion: trade.positionType,
            Contratos: trade.contracts,
            'Precio de Entrada': trade.entryPrice,
            'Precio de Salida': trade.exitPrice,
            'Tamaño de Contrato': trade.contractSize,
            'Margen Inicial': trade.initialMargin,
            'Comisiones/Slippage': trade.feesAndSlippage,
            Notas: trade.notes,
            'Ganancia/Pérdida Realizada': (parseFloat(trade.exitPrice) - parseFloat(trade.entryPrice)) * parseFloat(trade.contracts) * parseFloat(trade.contractSize) - parseFloat(trade.feesAndSlippage || 0)
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Historial de Trading");

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=historial_trading.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        res.status(500).json({ error: 'Error al exportar el historial a Excel.' });
    }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
