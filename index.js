import express from "express";
import dotenv from "dotenv";
import cors from "cors";         
import router from "./src/router.js";

dotenv.config();
const app = express();
app.use(express.json());

app.use(
  cors({
    origin: ["https://project-management-frontend-w48y.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

const PORT = process.env.PORT || 3000;

app.use("/api", router);

app.get("/", (req, res) => {
  res.send("RAG system running");
});

app.listen(PORT, () => {
  console.log(`Server started at ${PORT}`);
});
