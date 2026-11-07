import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

interface RoomState {
  elements: Record<string, any>;
}

const rooms = new Map<string, RoomState>();

io.on('connection', (socket) => {
  console.log(`Користувач підключився: ${socket.id}`);

  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    console.log(`Користувач ${socket.id} зайшов у кімнату: ${roomId}`);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { elements: {} });
    }
    
    // Відправляємо стан конкретної кімнати
    socket.emit('init-canvas', rooms.get(roomId)?.elements || {});
  });

  socket.on('draw-element', ({ roomId, element }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.elements[element.id] = element;
    }
    socket.to(roomId).emit('element-updated', element);
  });

  socket.on('cursor-move', ({ roomId, cursor }) => {
    socket.to(roomId).emit('cursor-updated', cursor);
  });

  socket.on('disconnect', () => {
    console.log(`Користувач відключився: ${socket.id}`);
  });
});
app.post('/api/generate-diagram', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Промпт обов\'язковий' });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const aiContent = response.text.trim();
        const cleanJson = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedElements = JSON.parse(cleanJson);
        
        res.json({ elements: generatedElements });

    } catch (error) {
        console.error('ПОМИЛКА GEMINI:', error);
        res.status(500).json({ error: error.message || 'Помилка генерації' });
    }
});
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(` WebSocket сервер успішно запущено на порту ${PORT}`);
});