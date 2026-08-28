const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs");

const app = express();

app.use(express.json());


// =====================================
// FIREBASE
// =====================================

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


// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {

  res.send("TradingAI Server ishlayapti!");

});


// =====================================
// SUPER MESSENGER NOTIFICATION
// =====================================

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
        await admin
          .messaging()
          .send(messageData);

      console.log(
        "FCM muvaffaqiyatli yuborildi:",
        response
      );

      res.json({

        success: true,

        messageId:
          response

      });

    } catch (sendError) {

      console.error(
        "FCM yuborish xatosi:",
        sendError
      );

      res.status(500).json({

        success: false,

        error:
          sendError.message

      });

    }

  } catch (error) {

    console.error(
      "Notification xatosi:",
      error
    );

    res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

});


// =====================================
// TRADING AI SIGNAL
// =====================================

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

    console.log(
      "symbol:",
      symbol
    );

    console.log(
      "timeframe:",
      timeframe
    );

    console.log(
      "signal:",
      signal
    );

    console.log(
      "entry:",
      entry
    );

    console.log(
      "stopLoss:",
      stopLoss
    );

    console.log(
      "takeProfit:",
      takeProfit
    );

    console.log(
      "strength:",
      strength
    );

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

      symbol:
        String(symbol),

      timeframe:
        String(timeframe),

      signal:
        String(signal),

      entry:
        Number(entry),

      stopLoss:
        Number(stopLoss || 0),

      takeProfit:
        Number(takeProfit || 0),

      strength:
        Number(strength || 0),

      rsi:
        Number(rsi || 0),

      ema9:
        Number(ema9 || 0),

      ema21:
        Number(ema21 || 0),

      atr:
        Number(atr || 0),

      support:
        Number(support || 0),

      resistance:
        Number(resistance || 0),

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

      signalId:
        newSignal.key,

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

      error:
        error.message

    });

  }

});


// =====================================
// FUNDAMENTAL ANALYSIS
// =====================================

let latestFundamentalData = {

  events: [],

  goldBias:
    "NEUTRAL",

  strength:
    0,

  timestamp:
    Date.now()

};


// =====================================
// GET FUNDAMENTAL DATA
// =====================================

app.get("/fundamental", (req, res) => {

  try {

    res.json({

      success:
        true,

      source:
        "Investing.com",

      data:
        latestFundamentalData

    });

  } catch (error) {

    console.error(
      "Fundamental GET xatosi:",
      error
    );

    res.status(500).json({

      success:
        false,

      error:
        error.message

    });

  }

});


// =====================================
// UPDATE FUNDAMENTAL DATA
// =====================================

app.post("/fundamental", (req, res) => {

  try {

    const {

      events,

      goldBias,

      strength

    } = req.body;


    if (!Array.isArray(events)) {

      return res.status(400).json({

        success:
          false,

        error:
          "events array kerak"

      });

    }


    latestFundamentalData = {

      events:
        events,

      goldBias:
        String(
          goldBias ||
          "NEUTRAL"
        ),

      strength:
        Number(
          strength ||
          0
        ),

      timestamp:
        Date.now()

    };


    console.log(
      "=== FUNDAMENTAL DATA ==="
    );

    console.log(
      "Events:",
      events.length
    );

    console.log(
      "Gold Bias:",
      goldBias
    );

    console.log(
      "Strength:",
      strength
    );


    res.json({

      success:
        true,

      message:
        "Fundamental ma'lumot saqlandi"

    });

  } catch (error) {

    console.error(
      "Fundamental update xatosi:",
      error
    );

    res.status(500).json({

      success:
        false,

      error:
        error.message

    });

  }

});


// =====================================
// MT5 CANDLE DATA
// =====================================

let latestMT5Data = null;


app.post("/mt5/candles", (req, res) => {

  try {

    const {
      symbol,
      timeframe,
      candles
    } = req.body;

    console.log(
      "=== MT5 CANDLE DATA ==="
    );

    console.log(
      "symbol:",
      symbol
    );

    console.log(
      "timeframe:",
      timeframe
    );

    console.log(
      "candles:",
      candles?.length
    );

    if (
      !symbol ||
      !timeframe ||
      !Array.isArray(candles)
    ) {

      return res.status(400).json({

        success: false,

        error:
          "symbol, timeframe va candles kerak"

      });

    }

    latestMT5Data = {

      symbol:
        String(symbol),

      timeframe:
        String(timeframe),

      candles:
        candles,

      timestamp:
        Date.now()

    };

    res.json({

      success: true,

      message:
        "MT5 ma'lumotlari qabul qilindi",

      candles:
        candles.length

    });

  } catch (error) {

    console.error(
      "MT5 candle xatosi:",
      error
    );

    res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

});


// =====================================
// GET LAST MT5 DATA
// =====================================

app.get("/mt5/latest", (req, res) => {

  if (!latestMT5Data) {

    return res.json({

      success: false,

      message:
        "Hali MT5 ma'lumotlari kelmagan"

    });

  }

  res.json({

    success: true,

    data:
      latestMT5Data

  });

});


// =====================================
// SERVER
// =====================================

const PORT =
  process.env.PORT || 3000;


app.listen(
  PORT,
  () => {

    console.log(
      `TradingAI Server ${PORT} portda ishga tushdi`
    );

  }
);
