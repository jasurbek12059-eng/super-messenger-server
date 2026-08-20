const express = require("express");
const admin = require("firebase-admin");

const app = express();

app.use(express.json());

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

app.get("/", (req, res) => {
  res.send("Super Messenger Server ishlayapti!");
});

app.post("/send-notification", async (req, res) => {
  try {
    const { receiverUid, message, senderName } = req.body;

    if (!receiverUid || !message) {
      return res.status(400).json({
        success: false,
        error: "receiverUid va message kerak"
      });
    }

    const tokenSnapshot = await db
      .ref("users/" + receiverUid + "/fcmToken")
      .once("value");

    const token = tokenSnapshot.val();

    if (!token) {
      return res.json({
        success: false,
        error: "Foydalanuvchining FCM tokeni topilmadi"
      });
    }

    await admin.messaging().send({
      token: token,
      notification: {
        title: senderName || "Super Messenger",
        body: message
      },
      data: {
        receiverUid: receiverUid
      }
    });

    res.json({
      success: true
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishga tushdi`);
});
