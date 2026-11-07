require('dotenv').config();
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
const rooms = new Map();
io.on('connection', (socket) => {
    console.log(`Користувач підключився: ${socket.id}`);
    socket.on('join-room', (roomId) => {
        var _a;
        socket.join(roomId);
        console.log(`Користувач ${socket.id} зайшов у кімнату: ${roomId}`);
        if (!rooms.has(roomId)) {
            rooms.set(roomId, { elements: {} });
        }
        // Відправляємо стан конкретної кімнати
        socket.emit('init-canvas', ((_a = rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.elements) || {});
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

        const fullPrompt = `Ты архитектор диаграмм. Пользователь просит: "${prompt}".
Верни ТОЛЬКО валидный JSON-массив прямоугольников БЕЗ КАКИХ-ЛИБО бэк-тиков (\`\`\`), без markdown. 
Пример формата:
[
  {
    "id": "1",
    "type": "rectangle",
    "points": [],
    "x": 100,
    "y": 100,
    "width": 160,
    "height": 80,
    "color": "#2563eb",
    "strokeWidth": 3
  }
]
Создай от 3 до 6 логически связанных блоков.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: fullPrompt,
        });

        const aiContent = response.text.trim();
        console.log('ОТВЕТ ОТ GEMINI:', aiContent);

        const cleanJson = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedElements = JSON.parse(cleanJson);
        
        res.json({ elements: generatedElements });

    } catch (error) {
        console.error('ПОМИЛКА ПРИ ПАРСИНГІ АБО GEMINI:', error);
        res.status(500).json({ error: error.message || 'Помилка генерації' });
    }
});
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(` WebSocket сервер успішно запущено на порту ${PORT}`);
});
