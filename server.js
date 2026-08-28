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

    const token = snapshot.val();

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

  bullishCount:
    0,

  bearishCount:
    0,

  score:
    0,

  timestamp:
    Date.now()

};


// =====================================
// CALCULATE GOLD IMPACT
// =====================================

function calculateGoldImpact(event) {

  const name =
    String(
      event.name || ""
    ).toLowerCase();

  const actual =
    Number(event.actual);

  const forecast =
    Number(event.forecast);

  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(forecast)
  ) {

    return {

      bias:
        "NEUTRAL",

      score:
        0

    };

  }

  const difference =
    actual - forecast;


  // ===================================
  // CPI / INFLATION / PCE
  // ===================================

  if (
    name.includes("cpi") ||
    name.includes("inflation") ||
    name.includes("pce")
  ) {

    if (difference < 0) {

      return {
        bias: "BULLISH",
        score: 3
      };

    }

    if (difference > 0) {

      return {
        bias: "BEARISH",
        score: -3
      };

    }

  }


  // ===================================
  // NFP / EMPLOYMENT
  // ===================================

  if (
    name.includes("nfp") ||
    name.includes("nonfarm") ||
    name.includes("non-farm") ||
    name.includes("employment")
  ) {

    if (difference < 0) {

      return {
        bias: "BULLISH",
        score: 3
      };

    }

    if (difference > 0) {

      return {
        bias: "BEARISH",
        score: -3
      };

    }

  }


  // ===================================
  // UNEMPLOYMENT
  // ===================================

  if (
    name.includes("unemployment")
  ) {

    if (difference > 0) {

      return {
        bias: "BULLISH",
        score: 2
      };

    }

    if (difference < 0) {

      return {
        bias: "BEARISH",
        score: -2
      };

    }

  }


  // ===================================
  // GDP
  // ===================================

  if (
    name.includes("gdp")
  ) {

    if (difference < 0) {

      return {
        bias: "BULLISH",
        score: 2
      };

    }

    if (difference > 0) {

      return {
        bias: "BEARISH",
        score: -2
      };

    }

  }


  // ===================================
  // JOBLESS CLAIMS
  // ===================================

  if (
    name.includes("jobless") ||
    name.includes("initial claims") ||
    name.includes("unemployment claims")
  ) {

    if (difference > 0) {

      return {
        bias: "BULLISH",
        score: 2
      };

    }

    if (difference < 0) {

      return {
        bias: "BEARISH",
        score: -2
      };

    }

  }


  return {

    bias:
      "NEUTRAL",

    score:
      0

  };

}


// =====================================
// FUNDAMENTAL ENGINE
// =====================================

function analyzeFundamentals(events) {

  let totalScore =
    0;

  let bullishCount =
    0;

  let bearishCount =
    0;

  const analyzedEvents =
    [];


  for (
    const event of events
  ) {

    const result =
      calculateGoldImpact(
        event
      );

    totalScore +=
      result.score;


    if (
      result.bias ===
      "BULLISH"
    ) {

      bullishCount++;

    }


    if (
      result.bias ===
      "BEARISH"
    ) {

      bearishCount++;

    }


    analyzedEvents.push({

      ...event,

      goldBias:
        result.bias,

      goldScore:
        result.score

    });

  }


  let goldBias =
    "NEUTRAL";


  if (
    totalScore > 0
  ) {

    goldBias =
      "BULLISH";

  }


  if (
    totalScore < 0
  ) {

    goldBias =
      "BEARISH";

  }


  const strength =
    Math.min(
      100,
      Math.abs(
        totalScore
      ) * 15
    );


  return {

    events:
      analyzedEvents,

    goldBias:
      goldBias,

    strength:
      strength,

    bullishCount:
      bullishCount,

    bearishCount:
      bearishCount,

    score:
      totalScore,

    timestamp:
      Date.now()

  };

}


// =====================================
// GET FUNDAMENTAL DATA
// =====================================

app.get(
  "/fundamental",
  (req, res) => {

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

  }
);


// =====================================
// UPDATE FUNDAMENTAL DATA
// =====================================

app.post(
  "/fundamental",
  (req, res) => {

    try {

      const {
        events
      } = req.body;


      if (
        !Array.isArray(events)
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "events array kerak"

        });

      }


      latestFundamentalData =
        analyzeFundamentals(
          events
        );


      console.log(
        "=== FUNDAMENTAL ENGINE ==="
      );

      console.log(
        "Events:",
        latestFundamentalData.events.length
      );

      console.log(
        "Gold Bias:",
        latestFundamentalData.goldBias
      );

      console.log(
        "Strength:",
        latestFundamentalData.strength
      );

      console.log(
        "Bullish:",
        latestFundamentalData.bullishCount
      );

      console.log(
        "Bearish:",
        latestFundamentalData.bearishCount
      );

      console.log(
        "Score:",
        latestFundamentalData.score
      );


      res.json({

        success:
          true,

        message:
          "Fundamental analysis bajarildi",

        data:
          latestFundamentalData

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

  }
);


// =====================================
// BLS TEST
// =====================================

app.get(
  "/fundamental/bls-test",
  async (req, res) => {

    try {

      const response =
        await fetch(
          "https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0?latest=true"
        );


      if (!response.ok) {

        throw new Error(
          "BLS API HTTP xatosi: " +
          response.status
        );

      }


      const data =
        await response.json();


      res.json({

        success:
          true,

        source:
          "BLS",

        data:
          data

      });

    } catch (error) {

      console.error(
        "BLS API xatosi:",
        error
      );

      res.status(500).json({

        success:
          false,

        error:
          error.message

      });

    }

  }
);


// =====================================
// MT5 CANDLE DATA
// =====================================

let latestMT5Data = null;


app.post(
  "/mt5/candles",
  (req, res) => {

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

          success:
            false,

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

        success:
          true,

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

        success:
          false,

        error:
          error.message

      });

    }

  }
);


// =====================================
// GET LAST MT5 DATA
// =====================================

app.get(
  "/mt5/latest",
  (req, res) => {

    if (!latestMT5Data) {

      return res.json({

        success:
          false,

        message:
          "Hali MT5 ma'lumotlari kelmagan"

      });

    }


    res.json({

      success:
        true,

      data:
        latestMT5Data

    });

  }
);


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
