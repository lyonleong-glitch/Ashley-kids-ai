 export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // Get the private Gemini API key from Vercel
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Ashley is not configured yet."
    });
  }

  // Get information from the website
  const { message, age, language } = req.body || {};

  // Check message
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Please enter a message."
    });
  }

  // Limit message size
  if (message.length > 500) {
    return res.status(400).json({
      error: "Please keep the message under 500 characters."
    });
  }

  // Ashley has two child modes
  const childAge = Number(age) === 6 ? 6 : 4;

  // Ashley supports Malaysia's three main languages
  const allowedLanguages = [
    "English",
    "Bahasa Melayu",
    "Chinese"
  ];
  // Built-in calculator for simple arithmetic
  // This makes basic maths accurate without relying on AI.

  const mathMatch = message.match(
    /(-?\d+(?:\.\d+)?)\s*([+\-−×x*/÷])\s*(-?\d+(?:\.\d+)?)/i
  );

  if (mathMatch) {
    const a = Number(mathMatch[1]);
    const operator = mathMatch[2];
    const b = Number(mathMatch[3]);

    let result;

    switch (operator) {
      case "+":
        result = a + b;
        break;
      case "-":
      case "−":
        result = a - b;
        break;
      case "×":
      case "x":
        result = a * b;
        break;
      case "*":
        result = a * b;
        break;
      case "/":
      case "÷":
        if (b === 0) {
          const zeroMessage =
            language === "中文"
              ? "除数不能是零哦！😊"
              : language === "Bahasa Melayu"
                ? "Kita tak boleh membahagi dengan sifar! 😊"
                : "We can't divide by zero! 😊";

          return res.status(200).json({
            reply: zeroMessage
          });
        }
        result = a / b;
        break;
    }

    if (Number.isFinite(result)) {
      const formattedResult = Number.isInteger(result)
        ? String(result)
        : String(Number(result.toFixed(6)));

      let reply;

      if (language === "中文" || language === "Chinese") {
        reply = `算出来啦！${a} ${operator} ${b} = ${formattedResult}！🎉`;
      } else if (language === "Bahasa Melayu") {
        reply = `Bagus! ${a} ${operator} ${b} = ${formattedResult}! 🎉`;
      } else {
        reply = `Great question! ${a} ${operator} ${b} = ${formattedResult}! 🎉`;
      }

      return res.status(200).json({ reply });
    }
  }
  const safeLanguage = allowedLanguages.includes(language)
    ? language
    : "English";

  // Ashley's personality and safety instructions
  const systemPrompt = `
You are Ashley, a warm, playful and safe AI learning companion for children in Malaysia.

The child is ${childAge} years old.

Reply in ${safeLanguage}.

PERSONALITY:
- Warm
- Playful
- Patient
- Curious
- Encouraging
- Friendly
- Never strict or scary

Ashley should feel like a friendly learning buddy rather than a teacher.

LEARNING STYLE:
- Use simple language suitable for the child's age.
- Keep answers short and easy to understand.
- Ask gentle questions when appropriate.
- Encourage the child to think instead of simply giving every answer.
- Use examples, stories, games and imagination.
- Celebrate effort, not only correct answers.
- Never shame the child for mistakes.

FOR THE 4-YEAR-OLD:
- Use very simple words.
- Use playful examples.
- Keep explanations especially short.
- Focus on curiosity, basic numbers, colours, shapes, animals, stories and everyday learning.

FOR THE 6-YEAR-OLD:
- Encourage curiosity and simple reasoning.
- Help prepare the child for primary school.
- Support reading, spelling, basic mathematics, science and general knowledge.
- When appropriate, give small challenges or puzzles.

LANGUAGES:
- English
- Bahasa Melayu
- Chinese

SAFETY:
- Never ask for the child's full name.
- Never ask for an address.
- Never ask for school name.
- Never ask for phone numbers.
- Never ask for passwords.
- Never ask for private photos.
- Never encourage a child to keep secrets from parents or caregivers.
- If a child shares personal information, gently remind them not to share private information online and to tell a trusted grown-up.
- Do not provide dangerous instructions.
- For medical, emergency, sexual or serious personal issues, tell the child to speak to a trusted grown-up.
- Never pretend to be a human.
- Never say Ashley can replace parents, family or real friends.

Keep normal answers under about 100 words.

Be kind, positive, encouraging and fun.
  `.trim();

  // Gemini request function
  async function askGemini() {
    return await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: systemPrompt
              }
            ]
          },

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message.trim()
                }
              ]
            }
          ],

          generationConfig: {
            maxOutputTokens: 250
          }
        })
      }
    );
  }

  try {
    /*
      Gemini can temporarily return 503 when the model
      is experiencing high demand.

      We retry with increasing delays:

      Attempt 1 → immediately
      Attempt 2 → wait 1 second
      Attempt 3 → wait 2 seconds
      Attempt 4 → wait 4 seconds
    */

    const maxAttempts = 4;

    let response;
    let data;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      if (attempt > 1) {
        const delay = Math.pow(2, attempt - 2) * 1000;

        await new Promise(resolve =>
          setTimeout(resolve, delay)
        );
      }

      response = await askGemini();

      data = await response.json();

      // Success
      if (response.ok) {
        break;
      }

      console.error(
        `Gemini attempt ${attempt} failed:`,
        response.status,
        JSON.stringify(data)
      );

      // Only retry temporary server/capacity errors
      if (
        response.status !== 503 &&
        response.status !== 429
      ) {
        break;
      }
    }

    // Gemini still failed after retries
    if (!response || !response.ok) {

      const status = response?.status || 500;

      console.error(
        "Gemini final error:",
        status,
        JSON.stringify(data)
      );

      if (status === 503) {
        return res.status(503).json({
          error:
            "Ashley is temporarily busy. Please try again in a little while. 💛"
        });
      }

      if (status === 429) {
        return res.status(429).json({
          error:
            "Ashley has reached the current free usage limit. Please try again later. 💛"
        });
      }

      return res.status(502).json({
        error:
          "Ashley could not get an answer from the AI service."
      });
    }

    // Extract Ashley's answer
    const reply = data.candidates
      ?.flatMap(candidate =>
        candidate.content?.parts || []
      )
      ?.map(part => part.text || "")
      ?.join("")
      ?.trim();

    // No answer returned
    if (!reply) {

      console.error(
        "Gemini returned no text:",
        JSON.stringify(data)
      );

      return res.status(502).json({
        error:
          "Ashley didn't receive an answer. Please try again."
      });
    }

    // Everything worked!
    return res.status(200).json({
      reply
    });

  } catch (error) {

    console.error(
      "Ashley API connection error:",
      error.message
    );

    return res.status(500).json({
      error:
        "Ashley could not connect to the AI service."
    });
  }
}