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

      return res.json({
        success: false,
        error:
          "FCM token topilmadi"
      });

    }

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

    const response =
      await admin
        .messaging()
        .send(messageData);

    res.json({

      success: true,

      messageId:
        response

    });

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
// FUNDAMENTAL ENGINE
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
// FUNDAMENTAL EVENT IMPACT
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


  // CPI / INFLATION / PCE

  if (
    name.includes("cpi") ||
    name.includes("inflation") ||
    name.includes("pce")
  ) {

    if (difference < 0) {

      return {
        bias:
          "BULLISH",
        score:
          3
      };

    }

    if (difference > 0) {

      return {
        bias:
          "BEARISH",
        score:
          -3
      };

    }

  }


  // NFP / EMPLOYMENT

  if (
    name.includes("nfp") ||
    name.includes("nonfarm") ||
    name.includes("non-farm") ||
    name.includes("employment")
  ) {

    if (difference < 0) {

      return {
        bias:
          "BULLISH",
        score:
          3
      };

    }

    if (difference > 0) {

      return {
        bias:
          "BEARISH",
        score:
          -3
      };

    }

  }


  // UNEMPLOYMENT

  if (
    name.includes("unemployment")
  ) {

    if (difference > 0) {

      return {
        bias:
          "BULLISH",
        score:
          2
      };

    }

    if (difference < 0) {

      return {
        bias:
          "BEARISH",
        score:
          -2
      };

    }

  }


  // GDP

  if (
    name.includes("gdp")
  ) {

    if (difference < 0) {

      return {
        bias:
          "BULLISH",
        score:
          2
      };

    }

    if (difference > 0) {

      return {
        bias:
          "BEARISH",
        score:
          -2
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
// FUNDAMENTAL ANALYSIS
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
// GET FUNDAMENTAL
// =====================================

app.get(
  "/fundamental",
  (req, res) => {

    res.json({

      success:
        true,

      source:
        "Fundamental Engine",

      data:
        latestFundamentalData

    });

  }
);


// =====================================
// UPDATE FUNDAMENTAL
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


      res.json({

        success:
          true,

        message:
          "Fundamental analysis bajarildi",

        data:
          latestFundamentalData

      });

    } catch (error) {

      res.status(500).json({

        success:
          false,

        error:
          error.message

      });

    }

  }
);// =====================================
// BLS MULTIPLE DATA
// =====================================

async function getBLSMultipleData() {

  const response =
    await fetch(
      "https://api.bls.gov/publicAPI/v2/timeseries/data/",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          seriesid: [
            "CUUR0000SA0",
            "LNS14000000",
            "CES0000000001"
          ],

          startyear: "2025",
          endyear: "2026"

        })
      }
    );


  if (!response.ok) {

    throw new Error(
      "BLS HTTP error: " +
      response.status
    );

  }


  const data =
    await response.json();


  console.log(
    "BLS status:",
    data.status
  );


  if (
    data.status !==
    "REQUEST_SUCCEEDED"
  ) {

    throw new Error(
      "BLS request failed: " +
      JSON.stringify(
        data.message || []
      )
    );

  }


  return data.Results.series;

}


// =====================================
// FIND BLS SERIES
// =====================================

function findBLSSeries(
  series,
  seriesId
) {

  return series.find(
    item =>
      item.seriesID === seriesId
  );

}


// =====================================
// CPI YEARLY
// =====================================

function calculateCPIYearly(data) {

  if (
    !Array.isArray(data) ||
    data.length < 2
  ) {

    return null;

  }


  const current =
    Number(data[0].value);


  const currentYear =
    Number(data[0].year);


  const currentPeriod =
    data[0].period;


  const previous =
    data.find(item =>
      Number(item.year) ===
        currentYear - 1 &&
      item.period ===
        currentPeriod
    );


  if (!previous) {

    return null;

  }


  const previousValue =
    Number(previous.value);


  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previousValue) ||
    previousValue === 0
  ) {

    return null;

  }


  return (
    (current - previousValue) /
    previousValue
  ) * 100;

}


// =====================================
// REAL FUNDAMENTAL
// =====================================

app.get(
  "/fundamental/real",
  async (req, res) => {

    try {

      console.log(
        "=== REAL FUNDAMENTAL DATA ==="
      );


      const series =
        await getBLSMultipleData();


      // ================================
      // CPI
      // ================================

      const cpiSeries =
        findBLSSeries(
          series,
          "CUUR0000SA0"
        );


      const cpiData =
        cpiSeries?.data || [];


      const cpi =
        calculateCPIYearly(
          cpiData
        );


      // ================================
      // UNEMPLOYMENT
      // ================================

      const unemploymentSeries =
        findBLSSeries(
          series,
          "LNS14000000"
        );


      const unemploymentData =
        unemploymentSeries?.data || [];


      const latestUnemployment =
        unemploymentData[0];


      const unemployment =
        latestUnemployment
          ? Number(
              latestUnemployment.value
            )
          : null;


      // ================================
      // NFP
      // ================================

      const nfpSeries =
        findBLSSeries(
          series,
          "CES0000000001"
        );


      const nfpData =
        nfpSeries?.data || [];


      const latestNFP =
        nfpData[0];


      const previousNFP =
        nfpData[1];


      const currentPayroll =
        latestNFP
          ? Number(
              latestNFP.value
            )
          : null;


      const previousPayroll =
        previousNFP
          ? Number(
              previousNFP.value
            )
          : null;


      let nfpChange =
        null;


      if (
        Number.isFinite(
          currentPayroll
        ) &&
        Number.isFinite(
          previousPayroll
        )
      ) {

        nfpChange =
          currentPayroll -
          previousPayroll;

      }


      // ================================
      // RESULT
      // ================================

      const result = {

        source:
          "BLS",


        CPI: {

          value:
            cpi,

          index:
            Number(
              cpiData?.[0]?.value
            ),

          year:
            cpiData?.[0]?.year,

          period:
            cpiData?.[0]?.periodName

        },


        unemployment: {

          value:
            unemployment,

          year:
            latestUnemployment?.year,

          period:
            latestUnemployment?.periodName

        },


        NFP: {

          employment:
            currentPayroll,

          previousEmployment:
            previousPayroll,

          change:
            nfpChange,

          year:
            latestNFP?.year,

          period:
            latestNFP?.periodName

        },


        timestamp:
          Date.now()

      };


      console.log(
        "CPI:",
        result.CPI.value
      );


      console.log(
        "Unemployment:",
        result.unemployment.value
      );


      console.log(
        "NFP:",
        result.NFP.employment
      );


      console.log(
        "NFP change:",
        result.NFP.change
      );


      res.json({

        success:
          true,

        data:
          result

      });


    } catch (error) {

      console.error(
        "Real fundamental xatosi:",
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
// FINAL TRADING AI
// TECHNICAL + FUNDAMENTAL
// =====================================

app.post(
  "/trading-ai/final",
  (req, res) => {

    try {

      const {

        technicalSignal,

        technicalStrength,

        fundamentalBias,

        fundamentalStrength,

        entry,

        support,

        resistance

      } = req.body;


      const tech =
        String(
          technicalSignal ||
          "WAIT"
        ).toUpperCase();


      const fund =
        String(
          fundamentalBias ||
          "NEUTRAL"
        ).toUpperCase();


      const techStrength =
        Number(
          technicalStrength || 0
        );


      const fundStrength =
        Number(
          fundamentalStrength || 0
        );


      // ================================
      // SCORE
      // ================================

      let score = 0;


      if (
        tech === "BUY"
      ) {

        score +=
          techStrength;

      }


      if (
        tech === "SELL"
      ) {

        score -=
          techStrength;

      }


      if (
        fund === "BULLISH"
      ) {

        score +=
          fundStrength;

      }


      if (
        fund === "BEARISH"
      ) {

        score -=
          fundStrength;

      }


      // ================================
      // STRENGTH
      // ================================

      const totalStrength =
        Math.round(
          Math.min(
            100,
            Math.abs(score) / 2
          )
        );


      // ================================
      // FINAL SIGNAL
      // ================================

      let finalSignal =
        "WAIT";


      if (
        score >= 30
      ) {

        finalSignal =
          "BUY";

      }


      if (
        score <= -30
      ) {

        finalSignal =
          "SELL";

      }


      // ================================
      // CONFLICT PROTECTION
      // ================================

      if (
        tech === "BUY" &&
        fund === "BEARISH"
      ) {

        finalSignal =
          "WAIT";

      }


      if (
        tech === "SELL" &&
        fund === "BULLISH"
      ) {

        finalSignal =
          "WAIT";

      }


      // ================================
      // RESULT
      // ================================

      const result = {

        signal:
          finalSignal,

        strength:
          totalStrength,


        technical: {

          signal:
            tech,

          strength:
            techStrength

        },


        fundamental: {

          bias:
            fund,

          strength:
            fundStrength

        },


        entry:
          Number(
            entry || 0
          ),


        support:
          Number(
            support || 0
          ),


        resistance:
          Number(
            resistance || 0
          ),


        timestamp:
          Date.now()

      };


      console.log(
        "=== FINAL TRADING AI ==="
      );


      console.log(
        JSON.stringify(
          result,
          null,
          2
        )
      );


      res.json({

        success:
          true,

        data:
          result

      });


    } catch (error) {

      console.error(
        "Final TradingAI xatosi:",
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
// MT5 CANDLES
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
// GET MT5
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
