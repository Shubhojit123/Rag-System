import express from "express";
import { addDocument, chat } from "./controller.js";

const router = express.Router();

router.post("/add", addDocument);
router.post("/chat", chat);

export default router;
