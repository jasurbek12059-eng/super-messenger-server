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

    console.log("=== NOTIFICATION REQUEST ===");

    const {
      receiverUid,
      message,
      senderName,
      senderUid
    } = req.body;

    console.log("receiverUid:", receiverUid);
    console.log("senderUid:", senderUid);
    console.log("senderName:", senderName);
    console.log("message:", message);

    if (!receiverUid || !message || !senderUid) {

      console.log("XATO: kerakli ma'lumot yetishmayapti");

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

    console.log(
      "FCM token topildi:",
      token ? "HA" : "YO'Q"
    );

    if (!token) {

      console.log(
        "XATO: FCM token topilmadi"
      );

      return res.json({
        success: false,
        error: "FCM token topilmadi"
      });
    }

    const response =
      await admin.messaging().send({

        token: token,

        notification: {
          title:
            senderName ||
            "Super Messenger",

          body: message
        },

        data: {
          senderUid:
            String(senderUid),

          senderName:
            String(senderName || ""),

          message:
            String(message)
        }
      });

    console.log(
      "FCM muvaffaqiyatli yuborildi:",
      response
    );

    res.json({
      success: true,
      messageId: response
    });

  } catch (error) {

    console.error(
      "=== NOTIFICATION XATOSI ==="
    );

    console.error(
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `Server ${PORT} portda ishga tushdi`
  );

});
