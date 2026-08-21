const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs");

const app = express();

app.use(express.json());

const serviceAccount = JSON.parse(
  fs.readFileSync(
    "/etc/secrets/firebase-service-account.json",
    "utf8"
  )
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

app.get("/", (req, res) => {
  res.send("Super Messenger Server ishlayapti!");
});

app.post("/send-notification", async (req, res) => {
  try {
    const {
      receiverUid,
      message,
      senderName,
      senderUid
    } = req.body;

    if (!receiverUid || !message || !senderUid) {
      return res.status(400).json({
        success: false,
        error: "receiverUid, message va senderUid kerak"
      });
    }

    const snapshot = await admin
      .database()
      .ref("users/" + receiverUid + "/fcmToken")
      .once("value");

    const token = snapshot.val();

    if (!token) {
      return res.json({
        success: false,
        error: "FCM token topilmadi"
      });
    }

    await admin.messaging().send({
      token: token,

      notification: {
        title: senderName || "Super Messenger",
        body: message
      },

      data: {
        senderUid: String(senderUid),
        senderName: String(senderName || ""),
        message: String(message)
      }
    });

    res.json({
      success: true
    });

  } catch (error) {

    console.error("Notification xatosi:", error);

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
