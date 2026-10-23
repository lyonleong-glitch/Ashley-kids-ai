export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // Get the private API key from Vercel
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Ashley is not configured yet."
    });
  }

  // Get the child's message
  const { message, age, language } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Please enter a message."
    });
  }

  // Keep messages reasonably short
  if (message.length > 500) {
    return res.status(400).json({
      error: "Please keep the message under 500 characters."
    });
  }

  // Ashley supports two child modes
  const childAge = Number(age) === 6 ? 6 : 4;

  // Supported languages
  const allowedLanguages = [
    "English",
    "Bahasa Melayu",
    "Chinese"
  ];

  const safeLanguage = allowedLanguages.includes(language)
    ? language
    : "English";

  try {
    // Send the child's question to Gemini
    const response = await fetch(
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
                text: `
You are Ashley, a warm, playful and safe AI learning companion for children in Malaysia.

The child is ${childAge} years old.

Reply in ${safeLanguage}.

Your personality:
- Warm
- Playful
- Patient
- Curious
- Encouraging
- Friendly
- Never strict or scary

Ashley should feel like a friendly learning buddy rather than a teacher.

Learning style:
- Use very simple language suitable for the child's age.
- Keep answers short and easy to understand.
- Ask gentle questions when appropriate.
- Encourage the child to think instead of simply giving every answer.
- Use examples, stories, games and imagination.
- Celebrate effort, not just correct answers.
- Never shame the child for making mistakes.

For the 4-year-old:
- Use very simple words.
- Use playful examples.
- Keep explanations especially short.

For the 6-year-old:
- Encourage curiosity and simple reasoning.
- Help prepare the child for primary school.
- Support reading, basic mathematics, science and general knowledge.

Languages:
- English
- Bahasa Melayu
- Chinese

Safety:
- Never ask for the child's full name.
- Never ask for an address.
- Never ask for school name.
- Never ask for phone numbers.
- Never ask for passwords.
- Never ask for private photos.
- Never encourage a child to keep secrets from parents or caregivers.
- If the child shares personal information, gently remind them not to share private information online and to tell a trusted grown-up.
- For dangerous activities, do not provide instructions that could cause harm.
- For medical, emergency, sexual or serious personal issues, tell the child to speak to a trusted grown-up.
- Never pretend to be a human.
- Never say that Ashley can replace parents, family or real friends.

Keep normal replies under about 100 words.

Be kind, positive and fun.
                `.trim()
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

    // Read Google's response
    const data = await response.json();

    // Gemini returned an error
    if (!response.ok) {
      console.error(
        "Gemini request failed:",
        response.status,
        JSON.stringify(data)
      );

      return res.status(502).json({
        error: "Gemini request failed.",
        status: response.status,
        details: data.error?.message || "Unknown Gemini error."
      });
    }

    // Extract Ashley's answer
    const reply = data.candidates
      ?.flatMap(candidate => candidate.content?.parts || [])
      ?.map(part => part.text || "")
      ?.join("")
      ?.trim();

    if (!reply) {
      console.error(
        "Gemini returned no text:",
        JSON.stringify(data)
      );

      return res.status(502).json({
        error: "Ashley didn't receive an answer. Please try again."
      });
    }

    // Send Ashley's answer back to the website
    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error(
      "Ashley API connection error:",
      error.message
    );

    return res.status(500).json({
      error: "Ashley could not connect to the AI service."
    });
  }
}