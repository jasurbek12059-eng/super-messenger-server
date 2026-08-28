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

    console.log("receiverUid:", receiverUid);
    console.log("senderUid:", senderUid);
    console.log("senderName:", senderName);
    console.log("message:", message);

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
    };

    try {

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


/*
 * =====================================
 * TRADING AI SIGNAL
 * =====================================
 */

app.post("/trading-signal", async (req, res) => {

  try {

    const {
      symbol,
      timeframe,
      signal,
      entry,
      stopLoss,
      takeProfit,
      strength,
      rsi,
      ema9,
      ema21,
      atr,
      support,
      resistance
    } = req.body;

    console.log(
      "=== TRADING AI SIGNAL ==="
    );

    console.log("symbol:", symbol);
    console.log("timeframe:", timeframe);
    console.log("signal:", signal);
    console.log("entry:", entry);
    console.log("stopLoss:", stopLoss);
    console.log("takeProfit:", takeProfit);
    console.log("strength:", strength);

    if (
      !symbol ||
      !timeframe ||
      !signal ||
      entry === undefined
    ) {

      return res.status(400).json({
        success: false,
        error:
          "symbol, timeframe, signal va entry kerak"
      });
    }

    const signalData = {
      symbol: String(symbol),
      timeframe: String(timeframe),
      signal: String(signal),

      entry: Number(entry),
      stopLoss: Number(stopLoss || 0),
      takeProfit: Number(takeProfit || 0),

      strength: Number(strength || 0),

      rsi: Number(rsi || 0),
      ema9: Number(ema9 || 0),
      ema21: Number(ema21 || 0),
      atr: Number(atr || 0),

      support: Number(support || 0),
      resistance: Number(resistance || 0),

      timestamp:
        admin.database.ServerValue.TIMESTAMP
    };

    const newSignal =
      await admin
        .database()
        .ref("tradingSignals")
        .push(signalData);

    console.log(
      "Trading signal saqlandi:",
      newSignal.key
    );

    res.json({
      success: true,
      signalId: newSignal.key,
      message:
        "TradingAI signali qabul qilindi"
    });

  } catch (error) {

    console.error(
      "Trading signal xatosi:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});/*
 * =====================================
 * SERVERNI ISHGA TUSHIRISH
 * =====================================
 */

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
