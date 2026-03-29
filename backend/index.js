import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try backend/.env first, then root .env
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const URI = process.env.URI;
const PORT = process.env.PORT || 3000;

if (!URI) {
  console.error("Missing URI in environment variables.");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

const todoSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    collection: "todos",
  }
);

const Todo = mongoose.model("Todo", todoSchema);

const toTodoResponse = (doc) => ({
  id: String(doc._id),
  content: doc.content,
  completed: doc.completed,
  createdAt: doc.createdAt,
});

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    message: "Backend is reachable",
    dbState: mongoose.connection.readyState, // 1 means connected
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/todo", async (req, res, next) => {
  try {
    const docs = await Todo.find().sort({ createdAt: -1 });
    res.json(docs.map(toTodoResponse));
  } catch (err) {
    next(err);
  }
});

app.get("/api/todo/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid todo id" });
    }

    const doc = await Todo.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.json(toTodoResponse(doc));
  } catch (err) {
    next(err);
  }
});

app.post("/api/todo", async (req, res, next) => {
  try {
    const content = String(req.body?.content ?? "").trim();
    if (!content) {
      return res.status(400).json({ message: "content is required" });
    }

    const doc = await Todo.create({
      content,
      completed: Boolean(req.body?.completed),
    });

    res.status(201).json(toTodoResponse(doc));
  } catch (err) {
    next(err);
  }
});

app.put("/api/todo/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid todo id" });
    }

    const update = {};
    if (req.body?.content !== undefined) {
      const content = String(req.body.content).trim();
      if (!content) {
        return res.status(400).json({ message: "content cannot be empty" });
      }
      update.content = content;
    }

    if (req.body?.completed !== undefined) {
      update.completed = Boolean(req.body.completed);
    }

    const doc = await Todo.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.json(toTodoResponse(doc));
  } catch (err) {
    next(err);
  }
});

app.delete("/api/todo/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid todo id" });
    }

    const result = await Todo.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

app.get("/", (req, res) => {
  res.json({ message: "Todo backend server running" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

mongoose
  .connect(URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });