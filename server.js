const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Super Messenger Server ishlayapti!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishga tushdi`);
});
