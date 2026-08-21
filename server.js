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

    console.log("=== NOTIFICATION REQUEST ===");

    console.log(
      "receiverUid:",
      receiverUid
    );

    console.log(
      "senderUid:",
      senderUid
    );

    console.log(
      "senderName:",
      senderName
    );

    console.log(
      "message:",
      message
    );

    if (
      !receiverUid ||
      !message ||
      !senderUid
    ) {

      return res.status(400).json({
        success: false,
        error:
          "receiverUid, message va senderUid kerak"
      });
    }

    const snapshot =
      await admin
        .database()
        .ref(
          "users/" +
          receiverUid +
          "/fcmToken"
        )
        .once("value");

    const token =
      snapshot.val();

    if (!token) {

      console.log(
        "FCM token topilmadi"
      );

      return res.json({
        success: false,
        error:
          "FCM token topilmadi"
      });
    }

    console.log(
      "FCM token topildi:",
      token.substring(0, 10)
    );

    /*
     * DIQQAT:
     *
     * Bu yerda notification:
     * { title, body }
     * YUBORILMAYDI.
     *
     * Faqat DATA yuboriladi.
     *
     * Shunda Androiddagi
     * MyFirebaseMessagingService
     * notificationni o'zi yaratadi.
     */

    const messageData = {
      token: token,

      data: {
        senderUid:
          String(senderUid),

        senderName:
          String(
            senderName ||
            "Super Messenger"
          ),

        message:
          String(message)
      },

      android: {
        priority: "high"
      }
    };    try {

      const response =
        await admin.messaging().send(
          messageData
        );

      console.log(
        "FCM muvaffaqiyatli yuborildi:",
        response
      );

      res.json({
        success: true,
        messageId: response
      });

    } catch (sendError) {

      console.error(
        "FCM yuborish xatosi:",
        sendError
      );

      res.status(500).json({
        success: false,
        error: sendError.message
      });
    }

  } catch (error) {

    console.error(
      "Notification xatosi:",
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

app.listen(
  PORT,
  () => {

    console.log(
      `Server ${PORT} portda ishga tushdi`
    );

  }
);
